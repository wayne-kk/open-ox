"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import {
  type DesignModeChildMessage,
  type DesignModeElementPayload,
  type DesignModeElementRect,
  type DesignModeProperty,
  DESIGN_MODE_PROTOCOL,
  getPreviewFramePostMessageOrigins,
  isDesignModeMessage,
  type VisualEdit,
} from "@/lib/studio/designMode/protocol";
import { designModeBridgeScriptPath } from "@/lib/studio/designMode/injectBridgeIntoHtml";
import { buildModifyDraftFromVisualEdits } from "@/lib/studio/designMode/buildModifyDraftFromVisualEdits";
import { propertyToUtility, upsertTailwindUtility } from "@/lib/studio/designMode/directPatch/sourceMutator";
import { formatSelectionModifyContext } from "@/lib/studio/designMode/selectionModifyContext";

/** A-class failures: Direct cannot safely mutate - hand off to Modify draft. */
const MODIFY_HANDOFF_CODES = new Set([
  "NO_SOURCE_MAPPING",
  "SOURCE_FILE_MISSING",
  "SOURCE_NODE_NOT_FOUND",
  "STATIC_TEXT_NOT_FOUND",
  "DYNAMIC_TEXT_UNSUPPORTED",
  "DYNAMIC_CLASS_UNSUPPORTED",
  "DIRECT_EDIT_DISABLED",
]);

export interface UseDesignModeOptions {
  projectId: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewUrl: string | null;
  previewReady: boolean;
  /** From preview API: local + Direct env. */
  directEditCapable: boolean;
  onPreviewRefresh?: (url: string | null) => void;
  /** Prefill Modify chat with a draft (user must confirm send). */
  onHandoffToModify?: (draft: string) => void;
  /** When true, Direct Apply is blocked (active BoardRun). */
  boardRunBlocking?: boolean;
}

export interface UseDesignModeResult {
  /** Element pick is always available when preview is ready. */
  pickEnabled: boolean;
  /** Floating Direct editor (sliders / Tailwind / Apply). */
  directEditCapable: boolean;
  active: boolean;
  bridgeReady: boolean;
  bridgeError: string | null;
  selected: DesignModeElementPayload | null;
  selectionBadgeLabel: string | null;
  anchorRect: DesignModeElementRect | null;
  styles: Record<DesignModeProperty, string>;
  className: string;
  mappedUtilities: Partial<Record<DesignModeProperty, string>>;
  textContent: string;
  canEditText: boolean;
  applyHint: string | null;
  patching: boolean;
  /** False when selection lacks source coords or is dynamic — use Modify. */
  canDirectPatch: boolean;
  precheckReason: string | null;
  showModifyHandoff: boolean;
  setActive: (next: boolean) => void;
  updateStyle: (property: DesignModeProperty, value: string) => void;
  updateText: (value: string) => void;
  updateClassName: (value: string) => void;
  applyDirectPatch: () => Promise<void>;
  handoffToModify: () => void;
  /** Short context for Modify send; null if nothing selected. */
  consumeSelectionForModify: () => string | null;
  undoLastApply: () => void;
  clearSelection: () => void;
}

const DEFAULT_STYLES: Record<DesignModeProperty, string> = {
  color: "#ffffff",
  fontSize: "16px",
  padding: "0px",
  borderRadius: "0px",
};

function stylesFromPayload(payload: DesignModeElementPayload): Record<DesignModeProperty, string> {
  return {
    color: payload.styles.color || DEFAULT_STYLES.color,
    fontSize: payload.styles.fontSize || DEFAULT_STYLES.fontSize,
    padding: payload.styles.padding || DEFAULT_STYLES.padding,
    borderRadius: payload.styles.borderRadius || DEFAULT_STYLES.borderRadius,
  };
}

function elementLabelFromPayload(payload: DesignModeElementPayload): string {
  const tag = payload.tagName.toLowerCase();
  const classes = payload.className
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2);
  return classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
}

function selectionBadgeFromPayload(payload: DesignModeElementPayload): string {
  const tag = payload.tagName.toLowerCase();
  if (payload.source) {
    const file = payload.source.file.split("/").pop() ?? payload.source.file;
    return `${tag} · ${file}:${payload.source.line}`;
  }
  return tag;
}

function colorToHex(input: string): string {
  const trimmed = input.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return "#000000";
  const toHex = (n: string) => Number.parseInt(n, 10).toString(16).padStart(2, "0");
  return `#${toHex(rgb[1]!)}${toHex(rgb[2]!)}${toHex(rgb[3]!)}`;
}

function parsePx(value: string, fallback: number): number {
  const match = value.match(/([\d.]+)/);
  if (!match) return fallback;
  const n = Number.parseFloat(match[1]!);
  return Number.isFinite(n) ? n : fallback;
}

export function useDesignMode({
  projectId,
  iframeRef,
  previewUrl,
  previewReady,
  directEditCapable,
  onPreviewRefresh,
  onHandoffToModify,
  boardRunBlocking = false,
}: UseDesignModeOptions): UseDesignModeResult {
  const pickEnabled = true;
  const [active, setActiveState] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DesignModeElementPayload | null>(null);
  const [anchorRect, setAnchorRect] = useState<DesignModeElementRect | null>(null);
  const [showModifyHandoff, setShowModifyHandoff] = useState(false);
  const [baselineStyles, setBaselineStyles] = useState<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const [styles, setStyles] = useState<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const [baselineClassName, setBaselineClassName] = useState("");
  const [className, setClassName] = useState("");
  const [baselineText, setBaselineText] = useState("");
  const [textContent, setTextContent] = useState("");
  const [canEditText, setCanEditText] = useState(false);
  const [applyHint, setApplyHint] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);
  const originalStylesRef = useRef<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const originalTextRef = useRef("");
  const originalClassNameRef = useRef("");
  const selectedRef = useRef<DesignModeElementPayload | null>(null);
  const bridgeReadyRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  selectedRef.current = selected;

  const postToFrame = useCallback(
    (message: Record<string, unknown>) => {
      const frame = iframeRef.current;
      if (!frame?.contentWindow || !previewUrl) return;
      const payload = { protocol: DESIGN_MODE_PROTOCOL, ...message };
      // Prefer concrete origins, but always include "*" — localhost vs 127.0.0.1
      // (and LAN preview hosts) otherwise silently drop INJECT_BRIDGE / PING.
      const origins = new Set([...getPreviewFramePostMessageOrigins(previewUrl), "*"]);
      for (const targetOrigin of origins) {
        try {
          frame.contentWindow.postMessage(payload, targetOrigin);
        } catch {
          /* invalid origin */
        }
      }
    },
    [iframeRef, previewUrl]
  );

  const injectBridgeIfNeeded = useCallback(() => {
    if (!previewUrl || typeof window === "undefined") return;
    const scriptUrl = `${window.location.origin}${designModeBridgeScriptPath()}`;
    postToFrame({ action: "INJECT_BRIDGE", scriptUrl });
  }, [postToFrame, previewUrl]);

  const pingBridge = useCallback(() => {
    injectBridgeIfNeeded();
    postToFrame({ action: "PING" });
    if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
    pingTimerRef.current = setTimeout(() => {
      if (!bridgeReadyRef.current) {
        injectBridgeIfNeeded();
        postToFrame({ action: "PING" });
      }
    }, 400);
  }, [injectBridgeIfNeeded, postToFrame]);

  const applySelectionPayload = useCallback((payload: DesignModeElementPayload) => {
    const nextStyles = stylesFromPayload(payload);
    originalStylesRef.current = nextStyles;
    setBaselineStyles(nextStyles);
    setStyles(nextStyles);
    const nextClass = (payload.className || "").toString().trim();
    originalClassNameRef.current = nextClass;
    setBaselineClassName(nextClass);
    setClassName(nextClass);
    const text = payload.textContent ?? payload.textPreview ?? "";
    originalTextRef.current = text;
    setBaselineText(text);
    setTextContent(text);
    setCanEditText(payload.canEditText ?? Boolean(text && payload.tagName));
    setAnchorRect(
      payload.rect ?? { top: 72, left: 24, width: 160, height: 28 }
    );
    setSelected(payload);
    setShowModifyHandoff(false);
    setApplyHint(null);
  }, []);

  const styleChanged = (["color", "fontSize", "padding", "borderRadius"] as DesignModeProperty[]).some(
    (p) => baselineStyles[p] !== styles[p]
  );
  const classNameChanged = baselineClassName !== className;

  const mappedUtilities = (() => {
    const mapped: Partial<Record<DesignModeProperty, string>> = {};
    for (const property of ["color", "fontSize", "padding", "borderRadius"] as DesignModeProperty[]) {
      if (baselineStyles[property] !== styles[property]) {
        mapped[property] = propertyToUtility(property, styles[property]);
      }
    }
    return mapped;
  })();

  const precheckReason = (() => {
    if (!selected) return null;
    if (!selected.source) {
      return "No source map (file:line:col) - rebuild local preview, or use Modify.";
    }
    if (canEditText && selected.textKind && selected.textKind !== "static" && baselineText !== textContent) {
      return "Dynamic text cannot be Direct-patched - use Modify.";
    }
    if (selected.classKind && selected.classKind !== "static" && (styleChanged || classNameChanged)) {
      return "Dynamic className cannot be Direct-patched - use Modify.";
    }
    return null;
  })();

  const canDirectPatch = directEditCapable && Boolean(selected?.source) && !precheckReason;

  useEffect(() => {
    if (!previewReady || !previewUrl) {
      setBridgeReady(false);
      bridgeReadyRef.current = false;
      return;
    }

    setBridgeReady(false);
    bridgeReadyRef.current = false;
    setBridgeError(null);

    const onMessage = (event: MessageEvent) => {
      if (!isDesignModeMessage(event.data)) return;
      const msg = event.data as DesignModeChildMessage;
      if (msg.action === "PONG" || msg.action === "BRIDGE_READY") {
        bridgeReadyRef.current = true;
        setBridgeReady(true);
        setBridgeError(null);
        if (bridgeFailTimerRef.current) {
          clearTimeout(bridgeFailTimerRef.current);
          bridgeFailTimerRef.current = null;
        }
      } else if (msg.action === "BOOTSTRAP_READY") {
        injectBridgeIfNeeded();
        postToFrame({ action: "PING" });
      } else if (msg.action === "ELEMENT_SELECTED") {
        applySelectionPayload(msg.payload);
      } else if (msg.action === "RECT_UPDATED") {
        setAnchorRect(msg.payload.rect);
      }
    };

    window.addEventListener("message", onMessage);

    const frame = iframeRef.current;
    const onLoad = () => {
      bridgeReadyRef.current = false;
      setBridgeReady(false);
      pingBridge();
    };
    frame?.addEventListener("load", onLoad);
    // Immediate + delayed retries: iframe may still be booting OpenOxPreviewBridge.
    pingBridge();
    const retryTimers = [800, 1600, 3200].map((ms) =>
      setTimeout(() => {
        if (!bridgeReadyRef.current) pingBridge();
      }, ms)
    );
    bridgeFailTimerRef.current = setTimeout(() => {
      if (!bridgeReadyRef.current) {
        setBridgeError(
          "Preview bridge unavailable - Rebuild Preview, then hard-refresh the iframe. Check that /open-ox/design-mode-bridge.js loads (must not redirect to /auth)."
        );
      }
    }, 8000);

    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", onLoad);
      if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
      if (bridgeFailTimerRef.current) clearTimeout(bridgeFailTimerRef.current);
      for (const t of retryTimers) clearTimeout(t);
      postToFrame({ action: "DISABLE" });
    };
  }, [applySelectionPayload, iframeRef, injectBridgeIfNeeded, pingBridge, postToFrame, previewReady, previewUrl]);

  useEffect(() => {
    if (active && bridgeReady) {
      postToFrame({ action: "ENABLE" });
      return () => {
        postToFrame({ action: "DISABLE" });
      };
    }
    postToFrame({ action: "DISABLE" });
    return undefined;
  }, [active, bridgeReady, postToFrame]);

  const setActive = useCallback(
    (next: boolean) => {
      setActiveState(next);
      if (!next) {
        setSelected(null);
        setAnchorRect(null);
        setApplyHint(null);
        setShowModifyHandoff(false);
        postToFrame({ action: "DISABLE" });
      }
    },
    [postToFrame]
  );

  const updateStyle = useCallback(
    (property: DesignModeProperty, value: string) => {
      setStyles((prev) => ({ ...prev, [property]: value }));
      setClassName((prevClass) => {
        const nextClass = upsertTailwindUtility(prevClass, property, value);
        postToFrame({ action: "PREVIEW_CLASSNAME", value: nextClass });
        return nextClass;
      });
      postToFrame({ action: "PREVIEW_PROPERTY", property, value });
    },
    [postToFrame]
  );

  const updateText = useCallback(
    (value: string) => {
      setTextContent(value);
      postToFrame({ action: "PREVIEW_TEXT", value });
    },
    [postToFrame]
  );

  const updateClassName = useCallback(
    (value: string) => {
      setClassName(value);
      postToFrame({ action: "PREVIEW_CLASSNAME", value });
    },
    [postToFrame]
  );

  const buildEditsFromSelection = useCallback((): VisualEdit[] => {
    if (!selected) return [];
    const elementLabel = elementLabelFromPayload(selected);
    const edits: VisualEdit[] = [];

    const oxId = selected.oxId ?? undefined;
    const source = selected.source ?? undefined;

    if (canEditText && baselineText !== textContent) {
      edits.push({
        kind: "text",
        source,
        oxId,
        selectorHint: selected.selectorHint,
        elementLabel,
        before: baselineText,
        after: textContent,
      });
    }

    // Prefer a single className write when the user edited classes (directly or via mapped styles).
    if (baselineClassName !== className) {
      edits.push({
        kind: "className",
        source,
        oxId,
        selectorHint: selected.selectorHint,
        elementLabel,
        before: baselineClassName,
        after: className,
      });
      return edits;
    }

    const properties: DesignModeProperty[] = ["color", "fontSize", "padding", "borderRadius"];
    for (const property of properties) {
      const before = baselineStyles[property];
      const after = styles[property];
      if (before !== after) {
        edits.push({
          kind: "style",
          source,
          oxId,
          selectorHint: selected.selectorHint,
          elementLabel,
          property,
          before,
          after,
        });
      }
    }
    return edits;
  }, [baselineClassName, baselineStyles, baselineText, canEditText, className, selected, styles, textContent]);

  const handoffToModify = useCallback(() => {
    const edits = buildEditsFromSelection();
    const draft =
      edits.length > 0
        ? buildModifyDraftFromVisualEdits(edits)
        : [
            "Studio Design Mode could not Direct-patch the selected element.",
            selected?.source
              ? `Source: \`${selected.source.file}:${selected.source.line}:${selected.source.column}\``
              : "No source map was available on the selection.",
            selected ? `Selector hint: \`${selected.selectorHint}\`` : "",
            precheckReason ?? "Please apply the intended visual tweak in source.",
          ]
            .filter(Boolean)
            .join("\n");
    if (!draft) return;
    onHandoffToModify?.(draft);
    setShowModifyHandoff(false);
    setApplyHint("Draft filled into Modify - review and send.");
    trackEvent("design_mode_modify_handoff", { hasSource: Boolean(selected?.source) });
  }, [buildEditsFromSelection, onHandoffToModify, precheckReason, selected]);

  const applyDirectPatch = useCallback(async () => {
    if (!projectId) return;
    if (boardRunBlocking) {
      setApplyHint("任务板进行中：请先完成、继续或取消剩余任务，再使用 Direct Apply。");
      return;
    }
    if (!directEditCapable) {
      setApplyHint("Direct Apply needs local preview + NEXT_PUBLIC_STUDIO_DESIGN_MODE=1. Use Modify with the selection.");
      return;
    }
    if (!canDirectPatch) {
      setShowModifyHandoff(true);
      setApplyHint(precheckReason ?? "Cannot Direct-patch this element - use Modify.");
      return;
    }
    const newEdits = buildEditsFromSelection();
    if (newEdits.length === 0) {
      setApplyHint("No changes to apply - adjust copy, Tailwind, or a style first.");
      return;
    }
    setPatching(true);
    setApplyHint(null);
    setShowModifyHandoff(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/design-mode/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits: newEdits,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        data?: { previewUrl?: string | null };
      };
      if (!res.ok) {
        if (body.code && MODIFY_HANDOFF_CODES.has(body.code)) {
          setShowModifyHandoff(true);
          setApplyHint(body.error ?? "Direct patch cannot apply - use Modify.");
          return;
        }
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setBaselineStyles(styles);
      setBaselineText(textContent);
      setBaselineClassName(className);
      originalStylesRef.current = styles;
      originalTextRef.current = textContent;
      originalClassNameRef.current = className;
      // Keep live preview as-is; RESET would flash the pre-edit look and look like Apply failed.
      postToFrame({ action: "COMMIT_PREVIEW" });
      setApplyHint("Saved to source - preview refreshing.");
      trackEvent("design_mode_direct_patch", { editCount: newEdits.length });
      onPreviewRefresh?.(body.data?.previewUrl ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Patch failed";
      setApplyHint(`Direct patch failed: ${msg}`);
    } finally {
      setPatching(false);
    }
  }, [
    boardRunBlocking,
    buildEditsFromSelection,
    canDirectPatch,
    className,
    directEditCapable,
    onPreviewRefresh,
    postToFrame,
    precheckReason,
    projectId,
    styles,
    textContent,
  ]);

  const consumeSelectionForModify = useCallback((): string | null => {
    const current = selectedRef.current;
    if (!current) return null;
    return formatSelectionModifyContext(current);
  }, []);

  const undoLastApply = useCallback(() => {
    setApplyHint("Undo is not available for direct patch yet - use git or Modify to revert.");
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setAnchorRect(null);
    setShowModifyHandoff(false);
    setApplyHint(null);
    postToFrame({ action: "RESET_PREVIEW" });
  }, [postToFrame]);

  const selectionBadgeLabel = selected ? selectionBadgeFromPayload(selected) : null;

  return {
    pickEnabled,
    directEditCapable,
    active,
    bridgeReady,
    bridgeError,
    selected,
    selectionBadgeLabel,
    anchorRect,
    styles,
    className,
    mappedUtilities,
    textContent,
    canEditText,
    applyHint,
    patching,
    canDirectPatch,
    precheckReason,
    showModifyHandoff,
    setActive,
    updateStyle,
    updateText,
    updateClassName,
    applyDirectPatch,
    handoffToModify,
    consumeSelectionForModify,
    undoLastApply,
    clearSelection,
  };
}

export { colorToHex, parsePx };
