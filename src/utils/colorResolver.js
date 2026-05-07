import tinycolor from 'tinycolor2';

/**
 * Try to parse a CMYK color input. Accepts these formats:
 *   "0,80,80,20"
 *   "0, 80, 80, 20"
 *   "C0 M80 Y80 K20"   (case-insensitive, any order)
 *   "cmyk(0,80,80,20)"
 * Each channel is a percentage 0-100.
 * Returns { r, g, b } (0-255 each) on success, or null.
 */
function parseCmyk(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();

  // Format 1 / 2: "0,80,80,20" or "0, 80, 80, 20" or "cmyk(0,80,80,20)"
  const stripped = s.replace(/^cmyk\s*\(|\)\s*$/gi, '').trim();
  const commaParts = stripped.split(/[,\s]+/).filter(Boolean);

  let c, m, y, k;

  // Labeled format: "C0 M80 Y80 K20"
  const labeled = s.match(/([CMYK])\s*:?\s*(\d+(?:\.\d+)?)/gi);
  if (labeled && labeled.length === 4) {
    const parts = {};
    for (const token of labeled) {
      const match = token.match(/([CMYK])\s*:?\s*(\d+(?:\.\d+)?)/i);
      if (match) parts[match[1].toUpperCase()] = Number(match[2]);
    }
    if ('C' in parts && 'M' in parts && 'Y' in parts && 'K' in parts) {
      c = parts.C; m = parts.M; y = parts.Y; k = parts.K;
    } else {
      return null;
    }
  } else if (commaParts.length === 4 && commaParts.every((p) => /^\d+(\.\d+)?$/.test(p))) {
    // Plain 4-number format
    [c, m, y, k] = commaParts.map(Number);
  } else {
    return null;
  }

  // Validate ranges
  if ([c, m, y, k].some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
    return null;
  }

  // Standard CMYK -> RGB conversion (0-100 input)
  const C = c / 100, M = m / 100, Y = y / 100, K = k / 100;
  const r = Math.round(255 * (1 - C) * (1 - K));
  const g = Math.round(255 * (1 - M) * (1 - K));
  const b = Math.round(255 * (1 - Y) * (1 - K));
  return { r, g, b };
}

/**
 * Accepts:
 *   - Color name ("red", "navy")
 *   - HEX ("#FF0000", "#F00", "FF0000")
 *   - rgb/hsl strings
 *   - CMYK in any format listed in parseCmyk()
 * Returns a clean #RRGGBB hex, or null if invalid.
 */
export function resolveColor(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (s === '') return null;

  // Try CMYK first (tinycolor doesn't understand CMYK)
  const cmyk = parseCmyk(s);
  if (cmyk) {
    return tinycolor(cmyk).toHexString();
  }

  // Fallback: tinycolor handles names, hex, rgb, hsl
  const c = tinycolor(s);
  return c.isValid() ? c.toHexString() : null;
}

/**
 * Validates a color string. Returns { valid, hex, error }.
 */
export function validateColor(input, fieldName = 'color') {
  if (input === null || input === undefined || String(input).trim() === '') {
    return { valid: false, hex: null, error: `${fieldName} is required` };
  }
  const hex = resolveColor(input);
  if (!hex) {
    return {
      valid: false,
      hex: null,
      error: `${fieldName} "${input}" is not a valid color (try a name, HEX like #FF0000, or CMYK like "0,80,80,20")`,
    };
  }
  return { valid: true, hex, error: null };
}

/**
 * Picks a readable text color (black or white) for a given background.
 */
export function contrastColor(bgHex) {
  const c = tinycolor(bgHex);
  return c.isLight() ? '#000000' : '#FFFFFF';
}

// ============================================================
// CMYK helpers — used by the print-ready (vector) PDF export
// ============================================================

/**
 * Parse a CMYK input string and return raw {c, m, y, k} channels (0-100).
 * Returns null if the input is not a recognised CMYK format.
 *
 * Unlike the existing parseCmyk() which converts to RGB and discards the
 * original CMYK values, this preserves the user's exact CMYK intent so we
 * can pass it straight to a print-ready PDF.
 */
export function parseCmykChannels(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  let c, m, y, k;

  // Labeled format: "C0 M80 Y80 K20" (case-insensitive, any order)
  const labeled = s.match(/([CMYK])\s*:?\s*(\d+(?:\.\d+)?)/gi);
  if (labeled && labeled.length === 4) {
    const parts = {};
    for (const token of labeled) {
      const match = token.match(/([CMYK])\s*:?\s*(\d+(?:\.\d+)?)/i);
      if (match) parts[match[1].toUpperCase()] = Number(match[2]);
    }
    if ('C' in parts && 'M' in parts && 'Y' in parts && 'K' in parts) {
      c = parts.C; m = parts.M; y = parts.Y; k = parts.K;
    } else {
      return null;
    }
  } else {
    // Comma/space separated (optionally wrapped with cmyk(...))
    const stripped = s.replace(/^cmyk\s*\(|\)\s*$/gi, '').trim();
    const tokens = stripped.split(/[,\s]+/).filter(Boolean);
    if (tokens.length === 4 && tokens.every((p) => /^\d+(\.\d+)?$/.test(p))) {
      [c, m, y, k] = tokens.map(Number);
    } else {
      return null;
    }
  }

  if ([c, m, y, k].some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
    return null;
  }

  return { c, m, y, k };
}

/**
 * Convert an sRGB hex (#RRGGBB) to CMYK channels (0-100 each).
 * Uses the standard "naive" device conversion; sufficient for general
 * print and what most consumer software uses without an ICC profile.
 */
export function rgbHexToCmyk(hex) {
  const c = tinycolor(hex);
  if (!c.isValid()) return null;
  const { r, g, b } = c.toRgb();
  const R = r / 255, G = g / 255, B = b / 255;
  const K = 1 - Math.max(R, G, B);
  if (K >= 0.999) return { c: 0, m: 0, y: 0, k: 100 }; // pure / near-pure black
  const denom = 1 - K;
  return {
    c: Math.round(((1 - R - K) / denom) * 100),
    m: Math.round(((1 - G - K) / denom) * 100),
    y: Math.round(((1 - B - K) / denom) * 100),
    k: Math.round(K * 100),
  };
}

/**
 * Resolve any supported color input to CMYK channels (0-100 each).
 *  - If the user typed CMYK ("C0 M80 Y80 K20"), preserve those exact values
 *    so they go straight into the PDF untouched.
 *  - Otherwise, convert from RGB (hex / name / rgb-string) to CMYK.
 * Returns null if the color is invalid.
 */
export function colorToCmyk(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;

  // 1) If the user typed a CMYK value, preserve their exact channels.
  const direct = parseCmykChannels(s);
  if (direct) return direct;

  // 2) Otherwise resolve to RGB hex first, then convert to CMYK.
  const hex = resolveColor(s);
  if (!hex) return null;
  return rgbHexToCmyk(hex);
}
