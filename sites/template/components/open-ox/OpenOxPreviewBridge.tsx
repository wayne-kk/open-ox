"use client";

import { useEffect } from "react";

const PROTOCOL = "OPEN_OX_DESIGN_MODE";
const BRIDGE_ATTR = "data-open-ox-design-bridge";

/**
 * Bootstrap for preview iframes (local next dev).
 * Auto-loads the full Design Mode bridge from the Studio origin so handshake
 * does not depend on catching a one-shot BOOTSTRAP_READY / INJECT_BRIDGE race.
 */
export function OpenOxPreviewBridge() {
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) {
      return;
    }

    function notifyParent(message: Record<string, unknown>) {
      window.parent.postMessage(message, "*");
    }

    function resolveStudioOrigin(): string | null {
      try {
        if (document.referrer) return new URL(document.referrer).origin;
      } catch {
        /* ignore */
      }
      const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
      if (ancestors && ancestors.length > 0) return ancestors[0]!;
      const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
      if (site) {
        try {
          return new URL(site).origin;
        } catch {
          /* ignore */
        }
      }
      return null;
    }

    function bridgeAlreadyRunning(): boolean {
      return Boolean((window as Window & { __openOxDesignModeBridge?: boolean }).__openOxDesignModeBridge);
    }

    function loadBridge(scriptUrl?: string) {
      if (bridgeAlreadyRunning()) return;
      let url = scriptUrl?.trim() || "";
      if (!url) {
        const origin = resolveStudioOrigin();
        if (!origin) return;
        url = `${origin}/open-ox/design-mode-bridge.js`;
      }
      const existing = document.querySelector<HTMLScriptElement>(`[${BRIDGE_ATTR}]`);
      if (existing) {
        const prev = existing.getAttribute("src") || "";
        if (prev === url) return;
        // Replace a dead/wrong src (e.g. http://127.0.0.1 injected behind TLS proxy).
        existing.remove();
      }
      const script = document.createElement("script");
      script.src = url;
      script.defer = true;
      script.dataset.openOxDesignBridge = "1";
      script.onerror = () => {
        console.warn("[OpenOxPreviewBridge] failed to load", url);
        script.remove();
      };
      document.head.appendChild(script);
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { protocol?: string; action?: string; scriptUrl?: string };
      if (!data || data.protocol !== PROTOCOL) return;
      if (data.action === "INJECT_BRIDGE") {
        loadBridge(data.scriptUrl);
        return;
      }
      if (data.action === "PING" && !bridgeAlreadyRunning()) {
        // Full bridge not loaded yet — re-announce so Studio can inject.
        notifyParent({ protocol: PROTOCOL, action: "BOOTSTRAP_READY" });
        loadBridge(data.scriptUrl);
      }
    }

    window.addEventListener("message", onMessage);
    loadBridge();
    notifyParent({ protocol: PROTOCOL, action: "BOOTSTRAP_READY" });

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
