import JSZip from 'jszip';
import jsPDF from 'jspdf';
import { colorToCmyk } from './colorResolver.js';
import { renderNameplate } from './canvasRenderer.js';

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXT = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
  pdf: 'pdf',
};

/**
 * Export a single canvas as a file and trigger browser download.
 *
 * `config` is optional. When supplied AND format is 'pdf', a print-ready
 * vector PDF is produced (CMYK fills/strokes, exact print dimensions in
 * millimetres). Without `config`, behaviour is unchanged — a raster PDF
 * is built from the canvas, exactly as before.
 */
export async function exportSingle(canvas, format, filename = 'nameplate', config = null) {
  const fmt = format.toLowerCase();
  const ext = EXT[fmt] || 'png';

  if (fmt === 'pdf') {
    const blob = config
      ? await buildVectorPdf(config)
      : await canvasToPdfBlob(canvas);
    downloadBlob(blob, `${filename}.pdf`);
    return;
  }

  let blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, MIME[fmt] || 'image/png', 0.92);
  });
  // Embed DPI metadata so the file opens at the correct mm/inch size in
  // print-aware tools (Illustrator, Photoshop, InDesign, Word, etc.).
  // Without this, those tools assume 72 or 96 DPI and read the file as
  // 3-4× larger than it really is.
  blob = await embedDpiMetadata(blob, fmt, config?.dpi || 300);
  downloadBlob(blob, `${filename}.${ext}`);
}

/**
 * Export many canvases as a single ZIP file.
 * entries: Array<{ canvas, filename, config? }>
 *
 * If `config` is present on an entry AND format is 'pdf', that entry
 * gets the print-ready vector PDF treatment.
 */
export async function exportBulkZip(entries, format, zipName = 'nameplates') {
  const fmt = format.toLowerCase();
  const ext = EXT[fmt] || 'png';
  const zip = new JSZip();

  for (const entry of entries) {
    const { canvas, filename, config } = entry;
    let blob;
    if (fmt === 'pdf') {
      blob = config
        ? await buildVectorPdf(config)
        : await canvasToPdfBlob(canvas);
    } else {
      blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, MIME[fmt] || 'image/png', 0.92);
      });
      // Embed DPI metadata (see exportSingle for rationale)
      blob = await embedDpiMetadata(blob, fmt, config?.dpi || 300);
    }
    zip.file(`${filename}.${ext}`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${zipName}.zip`);
}

// ============================================================
// PDF builders
// ============================================================

/**
 * Legacy raster PDF — embeds the canvas as a JPEG image. Still used as a
 * fallback when no config is supplied.
 */
async function canvasToPdfBlob(canvas) {
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height],
    hotfixes: ['px_scaling'],
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

/**
 * Print-ready vector PDF.
 *
 * Why this exists: when you print a screen-rendered (RGB) image, the
 * printer driver has to convert RGB → CMYK on the fly. Vibrant RGB
 * colors fall outside CMYK gamut and shift unpredictably (e.g. bright
 * blue can come out purplish). This builder writes the plate background
 * and borders directly into the PDF using CMYK color operators, so the
 * printer prints the exact CMYK ink mix we asked for — no guessing.
 *
 * Text is rendered onto a transparent overlay canvas (preserving the
 * existing multilingual / auto-fit / font handling) and placed on top.
 * Text colors are typically black or white, which print accurately
 * regardless of color space.
 */
async function buildVectorPdf(config) {
  const {
    width, height, unit = 'cm',
    bgColor = '#FFFFFF',
    borderColor = '',
    borderThickness = 0,
    borderStyle = 'single',
    cornerRadius = 0,
    outerColor = '',
    outerThickness = 0,
    gap = 0,
    innerColor = '',
    innerThickness = 0,
    dpi = 300,
    text = '',
  } = config;

  // Page size in millimetres — the universal print unit
  const widthMm = unitToMm(width, unit);
  const heightMm = unitToMm(height, unit);

  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  // The thickness/radius config values are in pixels at the chosen
  // export DPI. Convert them to mm so they line up with the PDF's mm
  // coordinate system and match the on-screen preview proportions.
  const pxToMm = 25.4 / (Number(dpi) || 300);
  const cornerMm = Math.max(0, (Number(cornerRadius) || 0) * pxToMm);
  const bThickMm = Math.max(0, (Number(borderThickness) || 0) * pxToMm);
  const oThickMm = Math.max(0, (Number(outerThickness) || 0) * pxToMm);
  const iThickMm = Math.max(0, (Number(innerThickness) || 0) * pxToMm);
  const gapMm = Math.max(0, (Number(gap) || 0) * pxToMm);

  // ----- Background fill (CMYK vector) -----
  // NOTE: jsPDF's setFillColor/setDrawColor passes CMYK values straight
  // through to the PDF stream WITHOUT dividing them. The PDF spec
  // requires CMYK channels in 0-1 range, but our colorToCmyk() returns
  // 0-100 (the human-readable scale). So we divide by 100 here.
  // Without this conversion, e.g. K=50 was being written as "50.0 k" and
  // PDF viewers clamped to pure black instead of 50% gray.
  const bgCmyk = colorToCmyk(bgColor) || { c: 0, m: 0, y: 0, k: 0 };
  setCmykFill(pdf, bgCmyk);
  drawRect(pdf, 0, 0, widthMm, heightMm, cornerMm, 'F');

  // ----- Borders (CMYK vector) -----
  const style = (borderStyle || 'single').toLowerCase();
  if (style === 'double') {
    drawStrokeAtOffset(
      pdf, widthMm, heightMm, cornerMm,
      colorToCmyk(outerColor), oThickMm, /*offsetFromEdge=*/ oThickMm / 2,
      /*dashed=*/ false,
    );
    if (oThickMm > 0 || iThickMm > 0) {
      const distance = oThickMm + gapMm + iThickMm / 2;
      const innerW = widthMm - 2 * distance;
      const innerH = heightMm - 2 * distance;
      if (innerW > 0 && innerH > 0) {
        const innerCmyk = colorToCmyk(innerColor);
        if (innerCmyk && iThickMm > 0) {
          setCmykDraw(pdf, innerCmyk);
          pdf.setLineWidth(iThickMm);
          setSolidLine(pdf);
          const r = Math.max(0, cornerMm - distance);
          drawRect(pdf, distance, distance, innerW, innerH, r, 'S');
        }
      }
    }
  } else if (style !== 'none' && bThickMm > 0) {
    drawStrokeAtOffset(
      pdf, widthMm, heightMm, cornerMm,
      colorToCmyk(borderColor), bThickMm, /*offsetFromEdge=*/ bThickMm / 2,
      /*dashed=*/ style === 'dashed',
    );
  }

  // ----- Text overlay (transparent canvas placed on top) -----
  if (text && String(text).length > 0) {
    const textCanvas = document.createElement('canvas');
    renderNameplate(textCanvas, { ...config, bodyTransparent: true });
    // PNG preserves alpha so the canvas-rendered text overlays cleanly
    // on the vector background underneath.
    const textImg = textCanvas.toDataURL('image/png');
    pdf.addImage(textImg, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  }

  return pdf.output('blob');
}

// Helper: draw a rect or rounded rect with the current fill/stroke style
function drawRect(pdf, x, y, w, h, radius, style) {
  if (radius > 0) {
    pdf.roundedRect(x, y, w, h, radius, radius, style);
  } else {
    pdf.rect(x, y, w, h, style);
  }
}

// Helper: stroke a rectangle inset from the page edge by `offsetFromEdge`
function drawStrokeAtOffset(pdf, widthMm, heightMm, cornerMm, cmyk, lineWidth, offsetFromEdge, dashed) {
  if (!cmyk || lineWidth <= 0) return;
  setCmykDraw(pdf, cmyk);
  pdf.setLineWidth(lineWidth);
  if (dashed) {
    setDashedLine(pdf, lineWidth);
  } else {
    setSolidLine(pdf);
  }
  const r = Math.max(0, cornerMm - offsetFromEdge);
  drawRect(
    pdf,
    offsetFromEdge,
    offsetFromEdge,
    widthMm - 2 * offsetFromEdge,
    heightMm - 2 * offsetFromEdge,
    r,
    'S',
  );
}

// jsPDF passes CMYK values through to the PDF stream unchanged. PDF spec
// expects 0-1, our colorToCmyk() returns 0-100, so we scale here.
function setCmykFill(pdf, cmyk) {
  pdf.setFillColor(cmyk.c / 100, cmyk.m / 100, cmyk.y / 100, cmyk.k / 100);
}
function setCmykDraw(pdf, cmyk) {
  pdf.setDrawColor(cmyk.c / 100, cmyk.m / 100, cmyk.y / 100, cmyk.k / 100);
}

// jsPDF's dash API has changed across versions; support both names safely
function setDashedLine(pdf, lineWidth) {
  const pattern = [lineWidth * 2, lineWidth];
  if (typeof pdf.setLineDashPattern === 'function') {
    pdf.setLineDashPattern(pattern, 0);
  } else if (typeof pdf.setLineDash === 'function') {
    pdf.setLineDash(pattern, 0);
  }
}

function setSolidLine(pdf) {
  if (typeof pdf.setLineDashPattern === 'function') {
    pdf.setLineDashPattern([], 0);
  } else if (typeof pdf.setLineDash === 'function') {
    pdf.setLineDash([], 0);
  }
}

function unitToMm(value, unit) {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) return 100;
  switch (String(unit).toLowerCase()) {
    case 'inch':
    case 'in':
      return n * 25.4;
    case 'cm':
      return n * 10;
    case 'mm':
      return n;
    default:
      return n * 10;
  }
}

// ============================================================
// DPI metadata injection for raster exports
// ============================================================
//
// Why this exists:
// `canvas.toBlob('image/png' | 'image/jpeg')` produces image files with
// pixel data only — no DPI / pixel-density metadata. Print-aware tools
// like Illustrator then default to 72 or 96 DPI, so a file rendered at
// 300 DPI opens 3-4× too large in millimetres. To fix this we patch the
// emitted blob:
//   - PNG: insert a `pHYs` chunk right after IHDR
//   - JPEG: patch the JFIF APP0 segment's density fields
//
// WebP has no widely-respected DPI chunk, so we leave WebP files alone.

async function embedDpiMetadata(blob, fmt, dpi) {
  try {
    if (fmt === 'png') return await injectPngDpi(blob, dpi);
    if (fmt === 'jpg' || fmt === 'jpeg') return await injectJpegDpi(blob, dpi);
    return blob; // webp / unknown — leave untouched
  } catch (err) {
    // If anything goes wrong (corrupt blob, unexpected format), don't
    // break the export — just return the original file.
    console.warn('DPI metadata injection failed; using original blob', err);
    return blob;
  }
}

// ----- PNG: pHYs chunk -----

async function injectPngDpi(blob, dpi) {
  const buf = new Uint8Array(await blob.arrayBuffer());

  // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) return blob;
  }

  // Walk chunks to find IHDR end and detect any existing pHYs chunk
  let pos = 8;
  let ihdrEnd = -1;
  let physStart = -1;
  let physTotalLen = 0;

  while (pos + 12 <= buf.length) {
    const length =
      ((buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]) >>> 0;
    const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    const totalLen = 4 + 4 + length + 4; // length + type + data + crc

    if (type === 'IHDR') ihdrEnd = pos + totalLen;
    if (type === 'pHYs') { physStart = pos; physTotalLen = totalLen; }
    if (type === 'IEND') break;

    pos += totalLen;
  }

  if (ihdrEnd < 0) return blob;

  const newChunk = makePhysChunk(dpi);

  let out;
  if (physStart >= 0) {
    // Replace the existing pHYs chunk in place
    out = new Uint8Array(buf.length - physTotalLen + newChunk.length);
    out.set(buf.subarray(0, physStart), 0);
    out.set(newChunk, physStart);
    out.set(buf.subarray(physStart + physTotalLen), physStart + newChunk.length);
  } else {
    // Insert pHYs right after IHDR
    out = new Uint8Array(buf.length + newChunk.length);
    out.set(buf.subarray(0, ihdrEnd), 0);
    out.set(newChunk, ihdrEnd);
    out.set(buf.subarray(ihdrEnd), ihdrEnd + newChunk.length);
  }

  return new Blob([out], { type: 'image/png' });
}

function makePhysChunk(dpi) {
  // Pixels per metre = DPI / 0.0254. e.g. 300 DPI -> 11811
  const ppm = Math.max(1, Math.round((Number(dpi) || 300) / 0.0254));

  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  // Length = 9 (big-endian)
  chunk[0] = 0; chunk[1] = 0; chunk[2] = 0; chunk[3] = 9;
  // Type = "pHYs"
  chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73;
  // Data: X ppm (4 bytes BE), Y ppm (4 bytes BE), unit (1 byte = 1 -> meter)
  chunk[8]  = (ppm >>> 24) & 0xFF;
  chunk[9]  = (ppm >>> 16) & 0xFF;
  chunk[10] = (ppm >>> 8)  & 0xFF;
  chunk[11] = ppm & 0xFF;
  chunk[12] = chunk[8];
  chunk[13] = chunk[9];
  chunk[14] = chunk[10];
  chunk[15] = chunk[11];
  chunk[16] = 1;
  // CRC-32 over (type + data) — bytes 4..16 inclusive (4 type + 9 data = 13 bytes)
  const crc = pngCrc32(chunk.subarray(4, 17));
  chunk[17] = (crc >>> 24) & 0xFF;
  chunk[18] = (crc >>> 16) & 0xFF;
  chunk[19] = (crc >>> 8)  & 0xFF;
  chunk[20] = crc & 0xFF;
  return chunk;
}

let CRC_TABLE = null;
function pngCrc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ----- JPEG: JFIF APP0 segment density bytes -----

async function injectJpegDpi(blob, dpi) {
  const buf = new Uint8Array(await blob.arrayBuffer()).slice();

  // Verify SOI
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return blob;

  // Walk segments to find APP0 / "JFIF\0"
  let pos = 2;
  while (pos + 4 < buf.length) {
    if (buf[pos] !== 0xFF) break; // malformed / not a marker
    const marker = buf[pos + 1];

    // Standalone markers (no length): RSTn (D0-D7), SOI (D8), EOI (D9)
    if (marker === 0xD9) break; // EOI
    if (marker === 0xDA) break; // SOS — image data starts; no more headers
    if (marker >= 0xD0 && marker <= 0xD8) { pos += 2; continue; }

    const segLen = (buf[pos + 2] << 8) | buf[pos + 3];
    if (segLen < 2 || pos + 2 + segLen > buf.length) break;

    // APP0 with "JFIF\0" identifier?
    if (
      marker === 0xE0 && segLen >= 16 &&
      buf[pos + 4] === 0x4A && buf[pos + 5] === 0x46 &&
      buf[pos + 6] === 0x49 && buf[pos + 7] === 0x46 &&
      buf[pos + 8] === 0x00
    ) {
      const dpiVal = Math.max(1, Math.round(Number(dpi) || 300));
      // Density unit = 1 (DPI)
      buf[pos + 11] = 1;
      // X density (big-endian)
      buf[pos + 12] = (dpiVal >>> 8) & 0xFF;
      buf[pos + 13] = dpiVal & 0xFF;
      // Y density (big-endian)
      buf[pos + 14] = (dpiVal >>> 8) & 0xFF;
      buf[pos + 15] = dpiVal & 0xFF;
      return new Blob([buf], { type: 'image/jpeg' });
    }

    pos += 2 + segLen;
  }

  // No JFIF segment found — return original blob unchanged
  return blob;
}

// ============================================================
// Misc helpers
// ============================================================

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sanitizeFilename(s) {
  return String(s)
    .replace(/[^a-z0-9_\-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'nameplate';
}
