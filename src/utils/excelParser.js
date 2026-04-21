import * as XLSX from 'xlsx';
import { validateColor } from './colorResolver.js';

const REQUIRED = ['sr_no', 'text', 'text_color', 'bg_color', 'width', 'height'];
const OPTIONAL = [
  'border_color', 'border_thickness',
  'border_style', 'corner_radius',
  // double-border fields
  'outer_color', 'outer_thickness',
  'gap',
  'inner_color', 'inner_thickness',
  'font_size', 'font_family',
];
const VALID_BORDER_STYLES = ['none', 'single', 'double', 'dashed'];
export const ALL_COLUMNS = [...REQUIRED, ...OPTIONAL];

/**
 * Parse an uploaded File (.xlsx or .csv) into an array of row objects.
 * Returns { rows, errors } where errors is a list of row-level validation issues.
 */
export async function parseSpreadsheet(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Prefer a sheet literally named "Nameplates", otherwise use the first sheet
  const sheetName = wb.SheetNames.includes('Nameplates')
    ? 'Nameplates'
    : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], errors: [{ row: 0, message: 'No sheet found in file' }] };
  }

  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (raw.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'Sheet is empty' }] };
  }

  // Normalize header names to lowercase, strip spaces
  const rows = raw.map((r) => {
    const out = {};
    for (const k of Object.keys(r)) {
      const key = k.toLowerCase().trim().replace(/\s+/g, '_');
      out[key] = r[k];
    }
    return out;
  });

  // Validate headers
  const firstKeys = Object.keys(rows[0]);
  const missing = REQUIRED.filter((c) => !firstKeys.includes(c));
  if (missing.length) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Missing required columns: ${missing.join(', ')}` }],
    };
  }

  // Validate per-row
  const errors = [];
  const cleanRows = [];
  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // sheet is 1-indexed + header row
    const rowErrors = validateRow(r, rowNum);
    if (rowErrors.length) {
      errors.push(...rowErrors);
    } else {
      cleanRows.push(normalizeRow(r));
    }
  });

  return { rows: cleanRows, errors };
}

function validateRow(r, rowNum) {
  const errs = [];

  // sr_no
  const srNo = Number(r.sr_no);
  if (!Number.isFinite(srNo) || srNo <= 0) {
    errs.push({ row: rowNum, message: `sr_no must be a positive number (got "${r.sr_no}")` });
  }

  // text
  if (!r.text || String(r.text).trim() === '') {
    errs.push({ row: rowNum, message: 'text is required' });
  }

  // colors
  const tc = validateColor(r.text_color, 'text_color');
  if (!tc.valid) errs.push({ row: rowNum, message: tc.error });

  const bc = validateColor(r.bg_color, 'bg_color');
  if (!bc.valid) errs.push({ row: rowNum, message: bc.error });

  // border_color is optional, but if provided must be valid
  if (r.border_color && String(r.border_color).trim() !== '') {
    const brc = validateColor(r.border_color, 'border_color');
    if (!brc.valid) errs.push({ row: rowNum, message: brc.error });
  }

  // width / height
  const w = Number(r.width);
  const h = Number(r.height);
  if (!Number.isFinite(w) || w <= 0) {
    errs.push({ row: rowNum, message: `width must be a positive number (got "${r.width}")` });
  }
  if (!Number.isFinite(h) || h <= 0) {
    errs.push({ row: rowNum, message: `height must be a positive number (got "${r.height}")` });
  }

  // border_thickness optional
  if (r.border_thickness !== '' && r.border_thickness != null) {
    const bt = Number(r.border_thickness);
    if (!Number.isFinite(bt) || bt < 0) {
      errs.push({ row: rowNum, message: `border_thickness must be >= 0 (got "${r.border_thickness}")` });
    }
  }

  // font_size optional ('auto' or number)
  if (r.font_size !== '' && r.font_size != null) {
    const fs = String(r.font_size).trim().toLowerCase();
    if (fs !== 'auto' && !Number.isFinite(Number(fs))) {
      errs.push({ row: rowNum, message: `font_size must be a number or 'auto' (got "${r.font_size}")` });
    }
  }

  // border_style optional - must be one of the known values
  if (r.border_style !== '' && r.border_style != null) {
    const bs = String(r.border_style).trim().toLowerCase();
    if (!VALID_BORDER_STYLES.includes(bs)) {
      errs.push({
        row: rowNum,
        message: `border_style must be one of: ${VALID_BORDER_STYLES.join(', ')} (got "${r.border_style}")`,
      });
    }
  }

  // corner_radius optional - non-negative number
  if (r.corner_radius !== '' && r.corner_radius != null) {
    const cr = Number(r.corner_radius);
    if (!Number.isFinite(cr) || cr < 0) {
      errs.push({ row: rowNum, message: `corner_radius must be >= 0 (got "${r.corner_radius}")` });
    }
  }

  // Double-border fields (all optional, only used when border_style = 'double')
  if (r.outer_color && String(r.outer_color).trim() !== '') {
    const oc = validateColor(r.outer_color, 'outer_color');
    if (!oc.valid) errs.push({ row: rowNum, message: oc.error });
  }
  if (r.inner_color && String(r.inner_color).trim() !== '') {
    const ic = validateColor(r.inner_color, 'inner_color');
    if (!ic.valid) errs.push({ row: rowNum, message: ic.error });
  }
  for (const f of ['outer_thickness', 'gap', 'inner_thickness']) {
    if (r[f] !== '' && r[f] != null) {
      const n = Number(r[f]);
      if (!Number.isFinite(n) || n < 0) {
        errs.push({ row: rowNum, message: `${f} must be >= 0 (got "${r[f]}")` });
      }
    }
  }

  return errs;
}

function normalizeRow(r) {
  const num = (v) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    sr_no: Number(r.sr_no),
    text: String(r.text).trim(),
    text_color: String(r.text_color).trim(),
    bg_color: String(r.bg_color).trim(),
    width: Number(r.width),
    height: Number(r.height),
    border_color: r.border_color ? String(r.border_color).trim() : '',
    border_thickness: num(r.border_thickness),
    border_style: r.border_style && String(r.border_style).trim() !== ''
      ? String(r.border_style).trim().toLowerCase()
      : 'single',
    corner_radius: num(r.corner_radius),
    // double-border fields
    outer_color: r.outer_color ? String(r.outer_color).trim() : '',
    outer_thickness: num(r.outer_thickness),
    gap: num(r.gap),
    inner_color: r.inner_color ? String(r.inner_color).trim() : '',
    inner_thickness: num(r.inner_thickness),
    font_size: r.font_size && String(r.font_size).trim() !== ''
      ? String(r.font_size).trim()
      : 'auto',
    font_family: r.font_family && String(r.font_family).trim() !== ''
      ? String(r.font_family).trim()
      : 'auto',
  };
}
