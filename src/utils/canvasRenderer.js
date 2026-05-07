import { toPixels } from './unitConverter.js';
import { resolveColor } from './colorResolver.js';
import { fontStackFor } from './fontLoader.js';

/**
 * Renders a nameplate onto the given canvas element.
 *
 * config:
 *   width, height     - numeric size
 *   unit              - 'cm' | 'mm' | 'inch'
 *   text              - string to print (supports English, Marathi, Hindi)
 *   textColor         - name or hex
 *   bgColor           - name or hex
 *
 *   borderStyle       - 'none' | 'single' | 'double' | 'dashed'
 *   cornerRadius      - px (optional, rounds plate corners)
 *
 *   For 'single' and 'dashed':
 *     borderColor     - name or hex
 *     borderThickness - px (number)
 *
 *   For 'double' (five independent settings):
 *     outerColor      - name or hex
 *     outerThickness  - px
 *     gap             - px (space between outer and inner borders)
 *     innerColor      - name or hex
 *     innerThickness  - px
 *
 *   fontSize          - points OR 'auto'
 *   dpi               - optional, defaults to 300 (export quality)
 */
export function renderNameplate(canvas, config) {
  const {
    width, height, unit = 'cm',
    text = '',
    textColor = '#000000',
    bgColor = '#FFFFFF',
    borderColor = '',
    borderThickness = 0,
    borderStyle = 'single',
    cornerRadius = 0,
    // double-border fields
    outerColor = '',
    outerThickness = 0,
    gap = 0,
    innerColor = '',
    innerThickness = 0,
    fontSize = 'auto',
    fontFamily = 'auto',
    dpi = 300,
    // Optional: when true, skip the background fill and borders so the
    // canvas contains only the text on a transparent background. Used by
    // the print-ready PDF exporter, which paints the plate body and
    // borders as vectors with CMYK colors. Defaults to false so all
    // existing on-screen previews and raster exports are unchanged.
    bodyTransparent = false,
  } = config;

  // Resolve colors
  const bg = resolveColor(bgColor) || '#FFFFFF';
  const fg = resolveColor(textColor) || '#000000';
  const style = (borderStyle || 'single').toLowerCase();
  const radius = Math.max(0, Number(cornerRadius) || 0);

  // Compute pixel dimensions
  const W = toPixels(width, unit, dpi);
  const H = toPixels(height, unit, dpi);

  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');

  // Calculate where text should sit (inside the borders) — needed even in
  // text-only mode so the overlay aligns with the vector borders.
  let borderFootprint = 0;
  if (style === 'double') {
    const ot = Math.max(0, Number(outerThickness) || 0);
    const g = Math.max(0, Number(gap) || 0);
    const it = Math.max(0, Number(innerThickness) || 0);
    borderFootprint = ot + g + it;
  } else if (style !== 'none') {
    const brdPx = Math.max(0, Number(borderThickness) || 0);
    if (resolveColor(borderColor) && brdPx > 0) borderFootprint = brdPx;
  }

  if (!bodyTransparent) {
    // ----- Background (with optional rounded corners) -----
    ctx.fillStyle = bg;
    if (radius > 0) {
      roundedRectPath(ctx, 0, 0, W, H, radius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, W, H);
    }

    // ----- Border -----
    if (style === 'double') {
      const oc = resolveColor(outerColor);
      const ot = Math.max(0, Number(outerThickness) || 0);
      const g = Math.max(0, Number(gap) || 0);
      const ic = resolveColor(innerColor);
      const it = Math.max(0, Number(innerThickness) || 0);
      drawDoubleBorder(ctx, W, H, oc, ot, g, ic, it, radius);
    } else if (style !== 'none') {
      const brd = resolveColor(borderColor);
      const brdPx = Math.max(0, Number(borderThickness) || 0);
      if (brd && brdPx > 0) {
        drawSimpleBorder(ctx, W, H, brd, brdPx, style, radius);
      }
    }
  }

  // ----- Text -----
  if (text && text.length > 0) {
    drawText(ctx, W, H, text, fg, borderFootprint, fontSize, fontFamily, dpi);
  }

  return canvas;
}

// ============================================================
// Border engine
// ============================================================

// Single or dashed border — one color, one thickness
function drawSimpleBorder(ctx, W, H, color, thickness, style, radius) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;

  if (style === 'dashed') {
    ctx.setLineDash([thickness * 2, thickness]);
  } else {
    ctx.setLineDash([]);
  }

  const half = thickness / 2;
  strokeRectOrRounded(
    ctx,
    half,
    half,
    W - thickness,
    H - thickness,
    Math.max(0, radius - half),
  );

  // Reset dash so it doesn't leak to anything drawn after
  ctx.setLineDash([]);
}

// Double border with 5 independent settings:
//   outerColor, outerThickness, gap, innerColor, innerThickness
//
// Layout from the edge inward:
//   [outer stroke][gap][inner stroke][plate interior]
//
// Any thickness can be 0 (meaning "no outer line" or "no inner line").
// Missing / invalid colors silently skip that stroke.
function drawDoubleBorder(ctx, W, H, outerColor, outerT, gap, innerColor, innerT, radius) {
  ctx.setLineDash([]);

  // --- Outer stroke ---
  if (outerColor && outerT > 0) {
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = outerT;
    const offset = outerT / 2;
    strokeRectOrRounded(
      ctx,
      offset,
      offset,
      W - outerT,
      H - outerT,
      Math.max(0, radius - offset),
    );
  }

  // --- Inner stroke ---
  if (innerColor && innerT > 0) {
    ctx.strokeStyle = innerColor;
    ctx.lineWidth = innerT;
    // Distance from the edge to the center of the inner stroke
    const distanceFromEdge = outerT + gap + innerT / 2;
    const x = distanceFromEdge;
    const y = distanceFromEdge;
    const w = W - 2 * distanceFromEdge;
    const h = H - 2 * distanceFromEdge;
    if (w > 0 && h > 0) {
      strokeRectOrRounded(
        ctx,
        x,
        y,
        w,
        h,
        Math.max(0, radius - distanceFromEdge),
      );
    }
  }
}

function strokeRectOrRounded(ctx, x, y, w, h, radius) {
  if (radius > 0) {
    roundedRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();
  } else {
    ctx.strokeRect(x, y, w, h);
  }
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ============================================================
// Text rendering (multilingual)
// ============================================================
function drawText(ctx, W, H, text, fg, borderFootprint, fontSize, chosenFont, dpi) {
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const pad = Math.max(borderFootprint + W * 0.04, 10);
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  // Choose font stack based on user's pick + the script in the text
  const fontFamily = fontStackFor(text, chosenFont);

  const isDeva = /[\u0900-\u097F]/.test(text);
  const lineHeightRatio = isDeva ? 1.35 : 1.15;

  let px;
  if (fontSize === 'auto' || fontSize === '' || fontSize == null) {
    px = autoFitFontSize(ctx, text, innerW, innerH, fontFamily, lineHeightRatio);
  } else {
    px = Math.round((Number(fontSize) / 72) * dpi);
  }

  ctx.font = `bold ${px}px ${fontFamily}`;

  const lines = wrapText(ctx, text, innerW);
  const lineHeight = px * lineHeightRatio;
  const totalHeight = lineHeight * lines.length;
  const startY = H / 2 - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * lineHeight);
  });
}

function autoFitFontSize(ctx, text, maxW, maxH, fontFamily, lineHeightRatio) {
  let lo = 8, hi = Math.floor(maxH);
  let best = lo;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `bold ${mid}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxW);
    const lineHeight = mid * lineHeightRatio;
    const totalHeight = lineHeight * lines.length;
    const widestLine = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (totalHeight <= maxH && widestLine <= maxW) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = String(text).split(/\r?\n/);
  const outLines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      outLines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) outLines.push(line);
        line = word;
      }
    }
    if (line) outLines.push(line);
  }
  return outLines.length ? outLines : [text];
}
