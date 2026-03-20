window.PortColorsColor = (() => {
  const { clamp, hashString } = window.PortColorsUtils;

  function normalizeHex(hex) {
    if (typeof hex !== "string") return "#000000";

    const cleaned = hex.trim().replace("#", "");

    if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
      return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toLowerCase();
    }

    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
      return `#${cleaned.toLowerCase()}`;
    }

    return "#000000";
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    const cleaned = normalized.slice(1);

    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = (value) =>
      clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function relativeLuminance(rgb) {
    return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  }

  function serviceToHex(code) {
    const hash = hashString(code);
    const r = 70 + (hash % 140);
    const g = 70 + (Math.floor(hash / 31) % 140);
    const b = 70 + (Math.floor(hash / 961) % 140);

    return rgbToHex(r, g, b);
  }

  function getAdaptiveBrightnessShift(rawShift, luminance) {
    if (luminance >= 0.85) {
      return -Math.max(6, Math.abs(rawShift));
    }

    if (luminance <= 0.15) {
      return Math.max(6, Math.abs(rawShift));
    }

    if (luminance >= 0.72 && rawShift > 0) {
      return Math.round(rawShift * 0.4);
    }

    if (luminance <= 0.28 && rawShift < 0) {
      return Math.round(rawShift * 0.4);
    }

    return rawShift;
  }

  function getTerminalVariant(terminalCode, baseHex) {
    const hash = hashString(terminalCode);
    const baseRgb = hexToRgb(baseHex);
    const luminance = relativeLuminance(baseRgb);

    const rawRShift = (hash % 17) - 8;
    const rawGShift = (Math.floor(hash / 31) % 17) - 8;
    const rawBShift = (Math.floor(hash / 961) % 17) - 8;
    const rawBrightnessShift = (Math.floor(hash / 29791) % 25) - 12;

    const chromaScale = luminance <= 0.15 || luminance >= 0.85 ? 0.55 : 0.8;

    return {
      rShift: Math.round(rawRShift * chromaScale),
      gShift: Math.round(rawGShift * chromaScale),
      bShift: Math.round(rawBShift * chromaScale),
      brightnessShift: getAdaptiveBrightnessShift(
        rawBrightnessShift,
        luminance,
      ),
    };
  }

  function applyVariant(baseHex, variant) {
    const baseRgb = hexToRgb(baseHex);

    return rgbToHex(
      baseRgb.r + variant.rShift + variant.brightnessShift,
      baseRgb.g + variant.gShift + variant.brightnessShift,
      baseRgb.b + variant.bShift + variant.brightnessShift,
    );
  }

  function getVesselColor(terminalCode, state) {
    const code = (terminalCode || "DEFAULT").trim().toUpperCase();
    const portCode = code.slice(0, 5);
    const base = state.portBaseColors[portCode];

    if (!base || !base.color) {
      return serviceToHex(code);
    }

    const baseHex = normalizeHex(base.color);
    const variant = getTerminalVariant(code, baseHex);

    return applyVariant(baseHex, variant);
  }

  return {
    normalizeHex,
    getTerminalVariant,
    getVesselColor,
  };
})();
