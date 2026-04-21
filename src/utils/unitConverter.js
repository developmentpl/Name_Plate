// 1 inch = 96 CSS pixels (standard). We use 300 DPI for export quality.
// For on-screen canvas rendering, 96 px/inch is fine.

const EXPORT_DPI = 300;   // used when exporting final images
const SCREEN_DPI = 96;    // used for on-screen preview

export function toPixels(value, unit, dpi = EXPORT_DPI) {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) return 0;
  switch (String(unit).toLowerCase()) {
    case 'inch':
    case 'in':
      return Math.round(n * dpi);
    case 'cm':
      return Math.round((n / 2.54) * dpi);
    case 'mm':
      return Math.round((n / 25.4) * dpi);
    case 'px':
      return Math.round(n);
    default:
      return Math.round((n / 2.54) * dpi); // default cm
  }
}

export function toScreenPixels(value, unit) {
  return toPixels(value, unit, SCREEN_DPI);
}

export { EXPORT_DPI, SCREEN_DPI };
