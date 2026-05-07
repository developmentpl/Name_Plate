import { useEffect, useRef, useState } from 'react';
import { renderNameplate } from '../utils/canvasRenderer.js';
import { resolveColor } from '../utils/colorResolver.js';
import { exportSingle, sanitizeFilename } from '../utils/exporter.js';
import { getAvailableFonts, loadFonts } from '../utils/fontLoader.js';
import ExportDialog from './ExportDialog.jsx';

const FONT_SIZES = ['auto', 12, 16, 20, 24, 32, 48, 64];

const DEFAULT = {
  width: 18,
  height: 6,
  unit: 'cm',
  text: 'Do Not Touch',
  textColor: '#FFFFFF',
  bgColor: '#1565C0',

  // simple border (used when borderStyle = single/dashed)
  borderColor: '#000000',
  borderThickness: 4,

  // double border - 5 independent controls
  outerColor: '#1565C0',
  outerThickness: 14,
  gap: 4,
  innerColor: '#FFFFFF',
  innerThickness: 3,

  borderStyle: 'double',
  cornerRadius: 12,
  fontSize: 'auto',
  fontFamily: 'auto',
};

export default function ManualMode() {
  const [config, setConfig] = useState(DEFAULT);
  const [showExport, setShowExport] = useState(false);
  const [fonts, setFonts] = useState(() => getAvailableFonts());
  const previewRef = useRef(null);
  const exportCanvasRef = useRef(document.createElement('canvas'));

  // After fonts finish loading, refresh the dropdown and re-render the preview
  useEffect(() => {
    loadFonts().then(() => {
      setFonts(getAvailableFonts());
      if (previewRef.current) {
        renderNameplate(previewRef.current, { ...config, dpi: 96 });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render to preview canvas whenever config changes
  useEffect(() => {
    if (previewRef.current) {
      renderNameplate(previewRef.current, { ...config, dpi: 96 });
    }
  }, [config]);

  const update = (field) => (e) => {
    const value = e.target.value;
    setConfig((c) => ({ ...c, [field]: value }));
  };

  const handleExport = (format) => {
    // Render at high DPI for download
    const exportConfig = { ...config, dpi: 300 };
    renderNameplate(exportCanvasRef.current, exportConfig);
    const fname = sanitizeFilename(config.text || 'nameplate');
    // Passing exportConfig enables the print-ready (CMYK vector) PDF path.
    // Other formats ignore it and behave exactly as before.
    exportSingle(exportCanvasRef.current, format, fname, exportConfig);
    setShowExport(false);
  };

  const bgValid = resolveColor(config.bgColor);
  const fgValid = resolveColor(config.textColor);
  const brValid = !config.borderColor || resolveColor(config.borderColor);

  return (
    <div className="manual-layout">
      <div className="card">
        <h2>Nameplate Settings</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Width</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={config.width}
              onChange={update('width')}
            />
          </div>
          <div className="form-group">
            <label>Height</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={config.height}
              onChange={update('height')}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Unit</label>
          <select value={config.unit} onChange={update('unit')}>
            <option value="cm">Centimeters (cm)</option>
            <option value="mm">Millimeters (mm)</option>
            <option value="inch">Inches (in)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Text (supports English, Marathi, Hindi)</label>
          <textarea
            value={config.text}
            onChange={update('text')}
            placeholder="e.g., Do Not Touch  |  थूकना सख्त मना है"
            rows={2}
            style={{ resize: 'vertical', minHeight: 44 }}
          />
        </div>

        <div className="form-group">
          <label>Background Color</label>
          <ColorField
            value={config.bgColor}
            onChange={update('bgColor')}
            valid={!!bgValid}
          />
        </div>

        <div className="form-group">
          <label>Text Color</label>
          <ColorField
            value={config.textColor}
            onChange={update('textColor')}
            valid={!!fgValid}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Border Style</label>
            <select value={config.borderStyle} onChange={update('borderStyle')}>
              <option value="none">None</option>
              <option value="single">Single</option>
              <option value="double">Double (outer + inner)</option>
              <option value="dashed">Dashed</option>
            </select>
          </div>
          <div className="form-group">
            <label>Corner Radius (px)</label>
            <input
              type="number"
              min="0"
              max="200"
              value={config.cornerRadius}
              onChange={update('cornerRadius')}
            />
          </div>
        </div>

        {(config.borderStyle === 'single' || config.borderStyle === 'dashed') && (
          <div className="form-row">
            <div className="form-group">
              <label>Border Color</label>
              <ColorField
                value={config.borderColor}
                onChange={update('borderColor')}
                valid={brValid}
              />
            </div>
            <div className="form-group">
              <label>Border Thickness (px)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.borderThickness}
                onChange={update('borderThickness')}
              />
            </div>
          </div>
        )}

        {config.borderStyle === 'double' && (
          <div style={{
            background: '#f0f7ff',
            border: '1px solid #cfe2f7',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#1f3864',
              textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10,
            }}>
              Double Border Settings
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Outer Color</label>
                <ColorField
                  value={config.outerColor}
                  onChange={update('outerColor')}
                  valid={!!resolveColor(config.outerColor)}
                />
              </div>
              <div className="form-group">
                <label>Outer Thickness (px)</label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={config.outerThickness}
                  onChange={update('outerThickness')}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Gap between borders (px)</label>
              <input
                type="number"
                min="0"
                max="200"
                value={config.gap}
                onChange={update('gap')}
              />
            </div>

            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Inner Color</label>
                <ColorField
                  value={config.innerColor}
                  onChange={update('innerColor')}
                  valid={!!resolveColor(config.innerColor)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Inner Thickness (px)</label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={config.innerThickness}
                  onChange={update('innerThickness')}
                />
              </div>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Font Family</label>
            <select value={config.fontFamily} onChange={update('fontFamily')}>
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Font Size</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={FONT_SIZES.includes(config.fontSize) || config.fontSize === 'auto' ? config.fontSize : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setConfig((c) => ({ ...c, fontSize: e.target.value }));
                  }
                }}
                style={{ flex: 1 }}
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'auto' ? 'Auto (fit)' : `${s} pt`}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              <input
                type="number"
                min="4"
                max="500"
                placeholder="pt"
                value={config.fontSize === 'auto' ? '' : config.fontSize}
                onChange={(e) => setConfig((c) => ({ ...c, fontSize: e.target.value || 'auto' }))}
                style={{ width: 70 }}
                title="Type any custom size"
              />
            </div>
          </div>
        </div>

        <div className="btn-group">
          <button
            className="btn btn-primary"
            onClick={() => setShowExport(true)}
            disabled={!bgValid || !fgValid || !brValid}
          >
            Download
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setConfig(DEFAULT)}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="card preview-card">
        <h2>Live Preview</h2>
        <div className="preview-stage">
          <canvas ref={previewRef} />
        </div>
        <div className="muted mt-2" style={{ textAlign: 'center' }}>
          {config.width} &times; {config.height} {config.unit}
        </div>
      </div>

      {showExport && (
        <ExportDialog
          onSelect={handleExport}
          onClose={() => setShowExport(false)}
          singleFile={true}
        />
      )}
    </div>
  );
}

function ColorField({ value, onChange, valid }) {
  // Pass through both text and color picker, synced
  const hex = resolveColor(value);
  return (
    <div>
      <div className="color-input-wrap">
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="#FF0000, red, or C0 M80 Y80 K20"
          title="Accepts name (red), HEX (#FF0000), or CMYK (0,80,80,20 or C0 M80 Y80 K20)"
          style={{ borderColor: valid ? undefined : '#dc2626' }}
        />
        <input
          type="color"
          value={hex || '#000000'}
          onChange={onChange}
          title="Pick a color"
        />
      </div>
      {!valid && <div className="input-error">Invalid color value</div>}
    </div>
  );
}
