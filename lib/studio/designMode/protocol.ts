/** PostMessage protocol between Studio (parent) and preview iframe (child). */

export const DESIGN_MODE_PROTOCOL = "OPEN_OX_DESIGN_MODE" as const;

import type { OxClassKind, OxSourceMeta, OxTextKind } from "./sourceInstrumentation/sourceMeta";

export type DesignModeProperty = "color" | "fontSize" | "padding" | "borderRadius";

export interface DesignModeElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DesignModeElementPayload {
  tagName: string;
  id: string | null;
  className: string;
  textPreview: string;
  /** Full trimmed text when the element is text-editable. */
  textContent?: string;
  canEditText?: boolean;
  /** Dev-only source mapping injected by the preview transformer. */
  source?: OxSourceMeta | null;
  textKind?: OxTextKind;
  classKind?: OxClassKind;
  /** Legacy semantic anchor fallback. */
  oxId?: string | null;
  selectorHint: string;
  rect?: DesignModeElementRect;
  styles: Record<DesignModeProperty, string>;
}

export type DesignModeParentMessage =
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "ENABLE" }
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "DISABLE" }
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "PING" }
  | {
      protocol: typeof DESIGN_MODE_PROTOCOL;
      action: "INJECT_BRIDGE";
      scriptUrl: string;
    }
  | {
      protocol: typeof DESIGN_MODE_PROTOCOL;
      action: "PREVIEW_PROPERTY";
      property: DesignModeProperty;
      value: string;
    }
  | {
      protocol: typeof DESIGN_MODE_PROTOCOL;
      action: "PREVIEW_TEXT";
      value: string;
    }
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "RESET_PREVIEW" };

export type DesignModeChildMessage =
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "PONG" }
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "BOOTSTRAP_READY" }
  | {
      protocol: typeof DESIGN_MODE_PROTOCOL;
      action: "ELEMENT_SELECTED";
      payload: DesignModeElementPayload;
    }
  | {
      protocol: typeof DESIGN_MODE_PROTOCOL;
      action: "RECT_UPDATED";
      payload: { rect: DesignModeElementRect };
    }
  | { protocol: typeof DESIGN_MODE_PROTOCOL; action: "BRIDGE_READY" };

export type VisualEdit =
  | {
      kind: "style";
      source?: OxSourceMeta;
      oxId?: string;
      selectorHint: string;
      elementLabel: string;
      property: DesignModeProperty;
      before: string;
      after: string;
    }
  | {
      kind: "text";
      source?: OxSourceMeta;
      oxId?: string;
      selectorHint: string;
      elementLabel: string;
      before: string;
      after: string;
    };

export function isDesignModeMessage(value: unknown): value is DesignModeParentMessage | DesignModeChildMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.protocol === DESIGN_MODE_PROTOCOL && typeof record.action === "string";
}

export function getPreviewFrameOrigin(previewUrl: string): string {
  return new URL(previewUrl, typeof window !== "undefined" ? window.location.href : "http://localhost").origin;
}

/** Loopback hostnames differ (`localhost` vs `127.0.0.1`) but refer to the same dev server — try both for postMessage. */
export function getPreviewFramePostMessageOrigins(previewUrl: string): string[] {
  const origins = new Set<string>();
  try {
    const url = new URL(previewUrl, typeof window !== "undefined" ? window.location.href : "http://localhost");
    origins.add(url.origin);
    if (url.hostname === "localhost") {
      origins.add(`http://127.0.0.1:${url.port || (url.protocol === "https:" ? "443" : "80")}`);
    } else if (url.hostname === "127.0.0.1") {
      origins.add(`http://localhost:${url.port || (url.protocol === "https:" ? "443" : "80")}`);
    }
  } catch {
    origins.add("http://localhost");
  }
  return [...origins];
}
