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

  function ensureMinShift(value, minimum) {
    if (Math.abs(value) >= minimum) return value;
    return value >= 0 ? minimum : -minimum;
  }

  function getTerminalVariant(terminalCode, baseHex) {
    const hash = hashString(terminalCode);
    const baseRgb = hexToRgb(baseHex);
    const luminance = relativeLuminance(baseRgb);

    const rawRShift = (hash % 31) - 15;
    const rawGShift = (Math.floor(hash / 31) % 31) - 15;
    const rawBShift = (Math.floor(hash / 961) % 31) - 15;
    const rawBrightnessShift = (Math.floor(hash / 29791) % 37) - 18;

    const chromaScale = luminance <= 0.15 || luminance >= 0.85 ? 0.6 : 0.85;

    const rShift = Math.round(rawRShift * chromaScale);
    const gShift = Math.round(rawGShift * chromaScale);
    const bShift = Math.round(rawBShift * chromaScale);
    const brightnessShift = getAdaptiveBrightnessShift(
      rawBrightnessShift,
      luminance,
    );

    const totalShift =
      Math.abs(rShift + brightnessShift) +
      Math.abs(gShift + brightnessShift) +
      Math.abs(bShift + brightnessShift);

    const minPerceptible = 30;

    if (totalShift < minPerceptible) {
      const boost =
        brightnessShift >= 0
          ? Math.max(10, minPerceptible - totalShift)
          : -Math.max(10, minPerceptible - totalShift);

      return {
        rShift: ensureMinShift(rShift, 5),
        gShift: ensureMinShift(gShift, 5),
        bShift: ensureMinShift(bShift, 5),
        brightnessShift: ensureMinShift(
          brightnessShift,
          boost > 0 ? boost : -boost,
        ),
      };
    }

    return {
      rShift,
      gShift,
      bShift,
      brightnessShift: ensureMinShift(brightnessShift, 8),
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
