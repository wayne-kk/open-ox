"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isStudioDesignModeEnabled } from "@/lib/studio/designMode/featureFlag";
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

export interface UseDesignModeOptions {
  projectId: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewUrl: string | null;
  previewReady: boolean;
  onPreviewRefresh?: (url: string | null) => void;
}

export interface UseDesignModeResult {
  featureEnabled: boolean;
  active: boolean;
  bridgeReady: boolean;
  bridgeError: string | null;
  selected: DesignModeElementPayload | null;
  anchorRect: DesignModeElementRect | null;
  styles: Record<DesignModeProperty, string>;
  textContent: string;
  canEditText: boolean;
  applyHint: string | null;
  patching: boolean;
  setActive: (next: boolean) => void;
  updateStyle: (property: DesignModeProperty, value: string) => void;
  updateText: (value: string) => void;
  applyDirectPatch: () => Promise<void>;
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
  onPreviewRefresh,
}: UseDesignModeOptions): UseDesignModeResult {
  const featureEnabled = isStudioDesignModeEnabled();
  const [active, setActiveState] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DesignModeElementPayload | null>(null);
  const [anchorRect, setAnchorRect] = useState<DesignModeElementRect | null>(null);
  const [baselineStyles, setBaselineStyles] = useState<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const [styles, setStyles] = useState<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const [baselineText, setBaselineText] = useState("");
  const [textContent, setTextContent] = useState("");
  const [canEditText, setCanEditText] = useState(false);
  const [applyHint, setApplyHint] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);
  const originalStylesRef = useRef<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const originalTextRef = useRef("");
  const bridgeReadyRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postToFrame = useCallback(
    (message: Record<string, unknown>) => {
      const frame = iframeRef.current;
      if (!frame?.contentWindow || !previewUrl) return;
      const payload = { protocol: DESIGN_MODE_PROTOCOL, ...message };
      for (const targetOrigin of getPreviewFramePostMessageOrigins(previewUrl)) {
        frame.contentWindow.postMessage(payload, targetOrigin);
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
    const text = payload.textContent ?? payload.textPreview ?? "";
    originalTextRef.current = text;
    setBaselineText(text);
    setTextContent(text);
    setCanEditText(payload.canEditText ?? Boolean(text && payload.tagName));
    setAnchorRect(
      payload.rect ?? { top: 72, left: 24, width: 160, height: 28 }
    );
    setSelected(payload);
  }, []);

  useEffect(() => {
    if (!featureEnabled || !previewReady || !previewUrl) {
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
    pingBridge();
    bridgeFailTimerRef.current = setTimeout(() => {
      if (!bridgeReadyRef.current) {
        setBridgeError("Preview bridge unavailable — click Rebuild Preview once (local preview injects bridge on restart).");
      }
    }, 5000);

    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", onLoad);
      if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
      if (bridgeFailTimerRef.current) clearTimeout(bridgeFailTimerRef.current);
      postToFrame({ action: "DISABLE" });
    };
  }, [applySelectionPayload, featureEnabled, iframeRef, injectBridgeIfNeeded, pingBridge, postToFrame, previewReady, previewUrl]);

  useEffect(() => {
    if (!featureEnabled) return;
    if (active && bridgeReady) {
      postToFrame({ action: "ENABLE" });
      return () => {
        postToFrame({ action: "DISABLE" });
      };
    }
    postToFrame({ action: "DISABLE" });
    return undefined;
  }, [active, bridgeReady, featureEnabled, postToFrame]);

  const setActive = useCallback(
    (next: boolean) => {
      setActiveState(next);
      if (!next) {
        setSelected(null);
        setAnchorRect(null);
        setApplyHint(null);
        postToFrame({ action: "DISABLE" });
      }
    },
    [postToFrame]
  );

  const updateStyle = useCallback(
    (property: DesignModeProperty, value: string) => {
      setStyles((prev) => ({ ...prev, [property]: value }));
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
  }, [baselineStyles, baselineText, canEditText, selected, styles, textContent]);

  const applyDirectPatch = useCallback(async () => {
    if (!projectId) return;
    const newEdits = buildEditsFromSelection();
    if (newEdits.length === 0) {
      setApplyHint("No changes to apply — adjust copy or a style first.");
      return;
    }
    setPatching(true);
    setApplyHint(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/design-mode/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits: newEdits,
          classNameHint: selected?.className ?? "",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { previewUrl?: string | null };
      };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setBaselineStyles(styles);
      setBaselineText(textContent);
      originalStylesRef.current = styles;
      originalTextRef.current = textContent;
      postToFrame({ action: "RESET_PREVIEW" });
      setApplyHint("Saved to source — preview refreshing.");
      trackEvent("design_mode_direct_patch", { editCount: newEdits.length });
      onPreviewRefresh?.(body.data?.previewUrl ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Patch failed";
      setApplyHint(`Direct patch failed: ${msg}`);
    } finally {
      setPatching(false);
    }
  }, [
    buildEditsFromSelection,
    onPreviewRefresh,
    postToFrame,
    projectId,
    selected?.className,
    styles,
    textContent,
  ]);

  const undoLastApply = useCallback(() => {
    setApplyHint("Undo is not available for direct patch yet — use git or Modify to revert.");
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setAnchorRect(null);
    postToFrame({ action: "RESET_PREVIEW" });
  }, [postToFrame]);

  return {
    featureEnabled,
    active,
    bridgeReady,
    bridgeError,
    selected,
    anchorRect,
    styles,
    textContent,
    canEditText,
    applyHint,
    patching,
    setActive,
    updateStyle,
    updateText,
    applyDirectPatch,
    undoLastApply,
    clearSelection,
  };
}

export { colorToHex, parsePx };
