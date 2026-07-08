/**
 * Runs inside the preview iframe. Loaded via HTML injection, dynamic inject, or template bootstrap.
 * Communicates with Studio parent through postMessage (OPEN_OX_DESIGN_MODE protocol).
 */
(function openOxDesignModeBridge() {
  var PROTOCOL = "OPEN_OX_DESIGN_MODE";
  var SKIP_TAGS = { html: 1, body: 1, head: 1, script: 1, style: 1, svg: 1, path: 1 };

  var enabled = false;
  var selectedEl = null;
  var hoverEl = null;
  var overlay = null;
  var hoverOverlay = null;
  var previewBackup = null;
  var previewTextBackup = null;
  var trackingSelection = false;

  function ensureOverlay(kind) {
    var node = kind === "hover" ? hoverOverlay : overlay;
    if (node && node.parentNode) return node;
    node = document.createElement("div");
    node.setAttribute("data-open-ox-design-overlay", kind);
    node.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483646;border:2px solid " +
      (kind === "hover" ? "rgba(247,147,26,0.85)" : "rgba(255,214,0,0.95)") +
      ";border-radius:2px;box-sizing:border-box;transition:top 0.05s,left 0.05s,width 0.05s,height 0.05s;";
    document.documentElement.appendChild(node);
    if (kind === "hover") hoverOverlay = node;
    else overlay = node;
    return node;
  }

  function readRect(el) {
    var rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  function positionOverlay(el, kind) {
    if (!el || !el.getBoundingClientRect) return;
    var rect = el.getBoundingClientRect();
    var node = ensureOverlay(kind);
    node.style.top = rect.top + "px";
    node.style.left = rect.left + "px";
    node.style.width = rect.width + "px";
    node.style.height = rect.height + "px";
    node.style.display = rect.width > 0 && rect.height > 0 ? "block" : "none";
  }

  function clearOverlay(kind) {
    var node = kind === "hover" ? hoverOverlay : overlay;
    if (node) node.style.display = "none";
  }

  function escapeClassToken(token) {
    return token.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }

  function elementSegment(el) {
    var tag = el.tagName.toLowerCase();
    if (el.id && el.id.trim()) return tag + "#" + escapeClassToken(el.id.trim());
    var classes = (el.className || "")
      .toString()
      .split(/\s+/)
      .map(function (c) {
        return c.trim();
      })
      .filter(Boolean)
      .slice(0, 2);
    if (classes.length) return tag + "." + classes.map(escapeClassToken).join(".");
    return tag;
  }

  function findOxId(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.getAttribute) {
        var id = node.getAttribute("data-ox-id");
        if (id && id.trim()) return id.trim();
      }
      node = node.parentElement;
    }
    return null;
  }

  function buildSelectorHint(el) {
    var segments = [];
    var node = el;
    while (node && node.tagName && segments.length < 5) {
      var tag = node.tagName.toLowerCase();
      if (SKIP_TAGS[tag]) break;
      segments.unshift(elementSegment(node));
      node = node.parentElement;
    }
    return segments.join(" > ") || "unknown-element";
  }

  function readStyles(el) {
    var computed = window.getComputedStyle(el);
    return {
      color: computed.color || "",
      fontSize: computed.fontSize || "",
      padding: computed.padding || "",
      borderRadius: computed.borderRadius || "",
    };
  }

  function textPreview(el) {
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 80 ? text.slice(0, 77) + "..." : text;
  }

  function canEditText(el) {
    if (!el || el.childElementCount > 0) return false;
    return Boolean((el.textContent || "").replace(/\s+/g, " ").trim());
  }

  function notifyParent(message) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  function buildPayload(el) {
    var trimmed = (el.textContent || "").replace(/\s+/g, " ").trim();
    return {
      tagName: el.tagName,
      id: el.id || null,
      className: (el.className || "").toString(),
      textPreview: textPreview(el),
      textContent: trimmed,
      canEditText: canEditText(el),
      oxId: findOxId(el),
      selectorHint: buildSelectorHint(el),
      rect: readRect(el),
      styles: readStyles(el),
    };
  }

  function notifyRectUpdated() {
    if (!selectedEl) return;
    positionOverlay(selectedEl, "select");
    notifyParent({
      protocol: PROTOCOL,
      action: "RECT_UPDATED",
      payload: { rect: readRect(selectedEl) },
    });
  }

  function startSelectionTracking() {
    if (trackingSelection) return;
    trackingSelection = true;
    window.addEventListener("scroll", notifyRectUpdated, true);
    window.addEventListener("resize", notifyRectUpdated, true);
  }

  function stopSelectionTracking() {
    if (!trackingSelection) return;
    trackingSelection = false;
    window.removeEventListener("scroll", notifyRectUpdated, true);
    window.removeEventListener("resize", notifyRectUpdated, true);
  }

  function selectElement(el) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName.toLowerCase();
    if (SKIP_TAGS[tag]) return;
    selectedEl = el;
    previewBackup = null;
    previewTextBackup = null;
    positionOverlay(el, "select");
    startSelectionTracking();
    notifyParent({
      protocol: PROTOCOL,
      action: "ELEMENT_SELECTED",
      payload: buildPayload(el),
    });
  }

  function onMouseMove(e) {
    if (!enabled) return;
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (el === hoverEl) return;
    hoverEl = el;
    var tag = el.tagName.toLowerCase();
    if (SKIP_TAGS[tag]) {
      clearOverlay("hover");
      return;
    }
    positionOverlay(el, "hover");
  }

  function onClick(e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    selectElement(e.target);
  }

  function enablePickMode() {
    enabled = true;
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
  }

  function disablePickMode() {
    enabled = false;
    document.documentElement.style.cursor = "";
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    hoverEl = null;
    clearOverlay("hover");
    clearOverlay("select");
    stopSelectionTracking();
  }

  function resetPreviewState() {
    if (selectedEl && previewBackup) {
      var props = ["color", "fontSize", "padding", "borderRadius"];
      for (var i = 0; i < props.length; i++) {
        var key = props[i];
        var cssKey =
          key === "fontSize"
            ? "font-size"
            : key === "borderRadius"
              ? "border-radius"
              : key;
        if (previewBackup[key] != null) selectedEl.style[cssKey] = previewBackup[key];
        else selectedEl.style.removeProperty(cssKey);
      }
    }
    if (selectedEl && previewTextBackup != null) {
      selectedEl.textContent = previewTextBackup;
    }
    previewBackup = null;
    previewTextBackup = null;
    if (selectedEl) positionOverlay(selectedEl, "select");
  }

  function cssPropertyName(property) {
    if (property === "fontSize") return "font-size";
    if (property === "borderRadius") return "border-radius";
    return property;
  }

  function applyPreviewProperty(property, value) {
    if (!selectedEl) return;
    if (!previewBackup) {
      previewBackup = {
        color: selectedEl.style.color || "",
        fontSize: selectedEl.style.fontSize || "",
        padding: selectedEl.style.padding || "",
        borderRadius: selectedEl.style.borderRadius || "",
      };
    }
    selectedEl.style[cssPropertyName(property)] = value;
    notifyRectUpdated();
  }

  function applyPreviewText(value) {
    if (!selectedEl || !canEditText(selectedEl)) return;
    if (previewTextBackup == null) {
      previewTextBackup = selectedEl.textContent || "";
    }
    selectedEl.textContent = value;
    notifyRectUpdated();
  }

  window.addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data || data.protocol !== PROTOCOL) return;
    switch (data.action) {
      case "ENABLE":
        enablePickMode();
        break;
      case "DISABLE":
        disablePickMode();
        resetPreviewState();
        selectedEl = null;
        break;
      case "PREVIEW_PROPERTY":
        if (data.property && data.value != null) applyPreviewProperty(data.property, String(data.value));
        break;
      case "PREVIEW_TEXT":
        if (data.value != null) applyPreviewText(String(data.value));
        break;
      case "RESET_PREVIEW":
        resetPreviewState();
        break;
      case "PING":
        notifyParent({ protocol: PROTOCOL, action: "PONG" });
        break;
      default:
        break;
    }
  });

  notifyParent({ protocol: PROTOCOL, action: "BRIDGE_READY" });
})();
