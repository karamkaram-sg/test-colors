let _toastTimer;

window.PortColorsUtils = {
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  normalizeHue(hue) {
    return ((hue % 360) + 360) % 360;
  },

  hashString(value) {
    let hash = 0;

    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }

    return hash;
  },

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  deepClone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  },

  showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  },
};
