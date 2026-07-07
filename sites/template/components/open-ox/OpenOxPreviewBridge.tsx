"use client";

import { useEffect } from "react";

const PROTOCOL = "OPEN_OX_DESIGN_MODE";

/**
 * Minimal bootstrap for preview iframes (local dev / E2B). Listens for INJECT_BRIDGE from Studio
 * and loads the full bridge script from the Open-OX app origin.
 */
export function OpenOxPreviewBridge() {
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) {
      return;
    }

    function notifyParent(message: Record<string, unknown>) {
      window.parent.postMessage(message, "*");
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { protocol?: string; action?: string; scriptUrl?: string };
      if (!data || data.protocol !== PROTOCOL || data.action !== "INJECT_BRIDGE") return;
      if (!data.scriptUrl || document.querySelector("[data-open-ox-design-bridge]")) return;
      const script = document.createElement("script");
      script.src = data.scriptUrl;
      script.defer = true;
      script.dataset.openOxDesignBridge = "1";
      document.head.appendChild(script);
    }

    window.addEventListener("message", onMessage);
    notifyParent({ protocol: PROTOCOL, action: "BOOTSTRAP_READY" });

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
