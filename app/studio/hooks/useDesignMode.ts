"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildModifyDraftFromVisualEdits } from "@/lib/studio/designMode/buildModifyDraftFromVisualEdits";
import {
  DESIGN_MODE_PROTOCOL,
  type DesignModeChildMessage,
  type DesignModeElementPayload,
  type DesignModeProperty,
  getPreviewFrameOrigin,
  isDesignModeMessage,
  type VisualEdit,
} from "@/lib/studio/designMode/protocol";
import { designModeBridgeScriptPath } from "@/lib/studio/designMode/injectBridgeIntoHtml";
import { isStudioDesignModeEnabled } from "@/lib/studio/designMode/featureFlag";
import { trackEvent } from "@/lib/analytics/client";

export interface UseDesignModeOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewUrl: string | null;
  previewReady: boolean;
  setModifyInstruction: (value: string) => void;
  onAppliedDraft?: () => void;
}

export interface UseDesignModeResult {
  featureEnabled: boolean;
  active: boolean;
  bridgeReady: boolean;
  bridgeError: string | null;
  selected: DesignModeElementPayload | null;
  styles: Record<DesignModeProperty, string>;
  pendingEdits: VisualEdit[];
  applyHint: string | null;
  setActive: (next: boolean) => void;
  updateStyle: (property: DesignModeProperty, value: string) => void;
  applyDraftToModify: () => void;
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
  iframeRef,
  previewUrl,
  previewReady,
  setModifyInstruction,
  onAppliedDraft,
}: UseDesignModeOptions): UseDesignModeResult {
  const featureEnabled = isStudioDesignModeEnabled();
  const [active, setActiveState] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DesignModeElementPayload | null>(null);
  const [baselineStyles, setBaselineStyles] = useState<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const [styles, setStyles] = useState<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const [pendingEdits, setPendingEdits] = useState<VisualEdit[]>([]);
  const [applyHint, setApplyHint] = useState<string | null>(null);
  const originalStylesRef = useRef<Record<DesignModeProperty, string>>(DEFAULT_STYLES);
  const lastApplyCountRef = useRef(0);
  const bridgeReadyRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postToFrame = useCallback(
    (message: Record<string, unknown>) => {
      const frame = iframeRef.current;
      if (!frame?.contentWindow || !previewUrl) return;
      const targetOrigin = getPreviewFrameOrigin(previewUrl);
      frame.contentWindow.postMessage({ protocol: DESIGN_MODE_PROTOCOL, ...message }, targetOrigin);
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
        const payload = msg.payload;
        const nextStyles = stylesFromPayload(payload);
        originalStylesRef.current = nextStyles;
        setBaselineStyles(nextStyles);
        setStyles(nextStyles);
        setSelected(payload);
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
        setBridgeError("Preview bridge unavailable — try Rebuild Preview or regenerate from the latest template.");
      }
    }, 5000);

    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", onLoad);
      if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
      if (bridgeFailTimerRef.current) clearTimeout(bridgeFailTimerRef.current);
      postToFrame({ action: "DISABLE" });
    };
  }, [featureEnabled, iframeRef, injectBridgeIfNeeded, pingBridge, postToFrame, previewReady, previewUrl]);

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

  const buildEditsFromCurrentStyles = useCallback((): VisualEdit[] => {
    if (!selected) return [];
    const elementLabel = `${selected.tagName.toLowerCase()}${selected.className ? `.${selected.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")}` : ""}`;
    const properties: DesignModeProperty[] = ["color", "fontSize", "padding", "borderRadius"];
    const edits: VisualEdit[] = [];
    for (const property of properties) {
      const before = baselineStyles[property];
      const after = styles[property];
      if (before !== after) {
        edits.push({
          selectorHint: selected.selectorHint,
          elementLabel,
          property,
          before,
          after,
        });
      }
    }
    return edits;
  }, [baselineStyles, selected, styles]);

  const applyDraftToModify = useCallback(() => {
    const newEdits = buildEditsFromCurrentStyles();
    if (newEdits.length === 0) {
      setApplyHint("No style changes to apply — adjust a property first.");
      return;
    }
    const merged = [...pendingEdits, ...newEdits];
    const draft = buildModifyDraftFromVisualEdits(merged);
    setPendingEdits(merged);
    lastApplyCountRef.current = newEdits.length;
    setModifyInstruction(draft);
    setApplyHint("Modify draft ready — review below and click Send to run Modify + build.");
    trackEvent("design_mode_apply", { editCount: merged.length });
    onAppliedDraft?.();
  }, [buildEditsFromCurrentStyles, onAppliedDraft, pendingEdits, setModifyInstruction]);

  const undoLastApply = useCallback(() => {
    const removeCount = lastApplyCountRef.current;
    if (removeCount <= 0) return;
    setPendingEdits((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, Math.max(0, prev.length - removeCount));
      const draft = buildModifyDraftFromVisualEdits(next);
      setModifyInstruction(draft);
      setApplyHint(next.length > 0 ? "Removed last visual apply from draft." : "Cleared Design Mode draft.");
      return next;
    });
    lastApplyCountRef.current = 0;
    postToFrame({ action: "RESET_PREVIEW" });
    if (selected) {
      setStyles(originalStylesRef.current);
    }
  }, [postToFrame, selected, setModifyInstruction]);

  const clearSelection = useCallback(() => {
    setSelected(null);
    postToFrame({ action: "RESET_PREVIEW" });
  }, [postToFrame]);

  return {
    featureEnabled,
    active,
    bridgeReady,
    bridgeError,
    selected,
    styles,
    pendingEdits,
    applyHint,
    setActive,
    updateStyle,
    applyDraftToModify,
    undoLastApply,
    clearSelection,
  };
}

export { colorToHex, parsePx };
