import { useEffect, useRef, useState } from 'react';
import { parseSpreadsheet } from '../utils/excelParser.js';
import { renderNameplate } from '../utils/canvasRenderer.js';
import { exportBulkZip, sanitizeFilename } from '../utils/exporter.js';
import ExportDialog from './ExportDialog.jsx';
import EditPlateModal from './EditPlateModal.jsx';

export default function BulkMode() {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [unit, setUnit] = useState('cm');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generated, setGenerated] = useState([]); // [{row, canvas, dataUrl}]
  const [showExport, setShowExport] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [exportCanvases, setExportCanvases] = useState(false);
  const dragRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setGenerated([]);
    setErrors([]);
    try {
      const { rows: parsedRows, errors: parsedErrors } = await parseSpreadsheet(f);
      setRows(parsedRows);
      setErrors(parsedErrors);
    } catch (err) {
      setErrors([{ row: 0, message: `Could not read file: ${err.message}` }]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const generate = async () => {
    setGenerating(true);
    setProgress(0);
    const results = [];
    const BATCH = 40;

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      for (const r of slice) {
        // Small canvas for preview (96 dpi equivalent, scaled)
        const previewCanvas = document.createElement('canvas');
        renderNameplate(previewCanvas, rowToConfig(r, unit, 96));
        const dataUrl = previewCanvas.toDataURL('image/png');
        results.push({ row: r, dataUrl });
      }
      setProgress(Math.min(i + BATCH, rows.length));
      // Yield to browser so UI updates
      await new Promise((r) => setTimeout(r, 0));
    }

    setGenerated(results);
    setGenerating(false);
  };

  const handleExport = async (format) => {
    setShowExport(false);
    setExportCanvases(true);
    // Re-render at high DPI for final export
    const entries = [];
    for (let i = 0; i < generated.length; i++) {
      const r = generated[i].row;
      const cfg = rowToConfig(r, unit, 300);
      const c = document.createElement('canvas');
      renderNameplate(c, cfg);
      const base = `${String(r.sr_no).padStart(4, '0')}_${sanitizeFilename(r.text)}`;
      // Attaching `config` enables the print-ready (CMYK vector) PDF path
      // when the user picks PDF. Other formats ignore it.
      entries.push({ canvas: c, filename: base, config: cfg });
    }
    await exportBulkZip(entries, format, `nameplates_${Date.now()}`);
    setExportCanvases(false);
  };

  const updateRow = (index, updated) => {
    const newRows = [...rows];
    newRows[index] = updated;
    setRows(newRows);

    // Re-render this one
    const previewCanvas = document.createElement('canvas');
    renderNameplate(previewCanvas, rowToConfig(updated, unit, 96));
    const newGen = [...generated];
    newGen[index] = { row: updated, dataUrl: previewCanvas.toDataURL('image/png') };
    setGenerated(newGen);
    setEditIndex(null);
  };

  const clearAll = () => {
    setFile(null);
    setRows([]);
    setErrors([]);
    setGenerated([]);
    setProgress(0);
  };

  const hasFile = !!file;
  const canGenerate = rows.length > 0 && !generating;
  const hasGenerated = generated.length > 0;

  return (
    <div className="bulk-steps">
      {/* STEP 1: Upload */}
      <div className="card">
        <div className="step-header">
          <div className={`step-number ${hasFile ? 'done' : ''}`}>1</div>
          <div className="step-title">Upload Excel or CSV</div>
        </div>

        <div
          className={`file-drop ${dragging ? 'dragging' : ''}`}
          onClick={() => document.getElementById('file-input').click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {file ? file.name : 'Click or drag a file here'}
          </div>
          <div className="muted mt-2">
            Supports .xlsx and .csv &mdash; expected columns: sr_no, text, text_color, bg_color, width, height (+ optional border_color, border_thickness, font_size)
          </div>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>

        {hasFile && rows.length > 0 && (
          <div className="file-info">
            ✓ Found <strong>{rows.length}</strong> valid nameplate{rows.length === 1 ? '' : 's'}{' '}
            in <strong>{file.name}</strong>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="error-list">
            {errors.slice(0, 50).map((e, i) => (
              <li key={i}>
                {e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}
              </li>
            ))}
            {errors.length > 50 && <li>... and {errors.length - 50} more errors</li>}
          </ul>
        )}
      </div>

      {/* STEP 2: Unit */}
      <div className="card">
        <div className="step-header">
          <div className={`step-number ${hasFile ? '' : 'disabled'}`}>2</div>
          <div className="step-title">Select Size Unit</div>
        </div>
        <div className="muted mb-2">
          This unit applies to <strong>all</strong> width / height values in your file.
        </div>
        <div className="form-group" style={{ maxWidth: 280 }}>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!hasFile}>
            <option value="cm">Centimeters (cm)</option>
            <option value="mm">Millimeters (mm)</option>
            <option value="inch">Inches (in)</option>
          </select>
        </div>
      </div>

      {/* STEP 3: Generate */}
      <div className="card">
        <div className="step-header">
          <div className={`step-number ${hasGenerated ? 'done' : canGenerate ? '' : 'disabled'}`}>3</div>
          <div className="step-title">
            Generate Nameplates
            {hasGenerated && <span className="badge success">{generated.length} ready</span>}
          </div>
        </div>

        <div className="btn-group">
          <button className="btn btn-primary" onClick={generate} disabled={!canGenerate}>
            {generating ? 'Generating...' : `Generate ${rows.length} Nameplate${rows.length === 1 ? '' : 's'}`}
          </button>
          {(hasFile || hasGenerated) && (
            <button className="btn btn-secondary" onClick={clearAll}>Clear</button>
          )}
        </div>

        {generating && (
          <>
            <div className="progress-bar mt-3">
              <div
                className="progress-fill"
                style={{ width: `${(progress / rows.length) * 100}%` }}
              />
            </div>
            <div className="muted" style={{ textAlign: 'center' }}>
              Processing {progress} of {rows.length}...
            </div>
          </>
        )}
      </div>

      {/* STEP 4: Preview + Export */}
      {hasGenerated && (
        <div className="card">
          <div className="preview-grid-header">
            <div>
              <div className="step-title">Preview &amp; Export</div>
              <div className="muted mt-2">
                Click any nameplate to edit it before export.
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowExport(true)}
              disabled={exportCanvases}
            >
              {exportCanvases ? 'Preparing ZIP...' : 'Download All (ZIP)'}
            </button>
          </div>

          <div className="preview-grid">
            {generated.map((g, i) => (
              <div
                key={i}
                className="grid-item"
                onClick={() => setEditIndex(i)}
              >
                <img src={g.dataUrl} alt={`Nameplate ${g.row.sr_no}`} />
                <div className="label">
                  #{g.row.sr_no} &middot; {g.row.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showExport && (
        <ExportDialog
          onSelect={handleExport}
          onClose={() => setShowExport(false)}
          singleFile={false}
        />
      )}

      {editIndex !== null && (
        <EditPlateModal
          row={rows[editIndex]}
          unit={unit}
          onSave={(updated) => updateRow(editIndex, updated)}
          onClose={() => setEditIndex(null)}
        />
      )}
    </div>
  );
}

// Convert a parsed Excel row into a renderer config
function rowToConfig(row, unit, dpi) {
  return {
    width: row.width,
    height: row.height,
    unit,
    text: row.text,
    textColor: row.text_color,
    bgColor: row.bg_color,
    borderColor: row.border_color,
    borderThickness: row.border_thickness,
    borderStyle: row.border_style,
    cornerRadius: row.corner_radius,
    // double-border fields
    outerColor: row.outer_color,
    outerThickness: row.outer_thickness,
    gap: row.gap,
    innerColor: row.inner_color,
    innerThickness: row.inner_thickness,
    fontSize: row.font_size,
    fontFamily: row.font_family,
    dpi,
  };
}
