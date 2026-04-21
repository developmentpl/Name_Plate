import { useEffect, useRef, useState } from 'react';
import { renderNameplate } from '../utils/canvasRenderer.js';
import { resolveColor } from '../utils/colorResolver.js';
import { getAvailableFonts } from '../utils/fontLoader.js';

const FONT_SIZES = ['auto', 12, 16, 20, 24, 32, 48, 64];

export default function EditPlateModal({ row, unit, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...row });
  const previewRef = useRef(null);

  useEffect(() => {
    if (previewRef.current) {
      renderNameplate(previewRef.current, {
        width: draft.width,
        height: draft.height,
        unit,
        text: draft.text,
        textColor: draft.text_color,
        bgColor: draft.bg_color,
        borderColor: draft.border_color,
        borderThickness: draft.border_thickness,
        borderStyle: draft.border_style,
        cornerRadius: draft.corner_radius,
        outerColor: draft.outer_color,
        outerThickness: draft.outer_thickness,
        gap: draft.gap,
        innerColor: draft.inner_color,
        innerThickness: draft.inner_thickness,
        fontSize: draft.font_size,
        fontFamily: draft.font_family,
        dpi: 96,
      });
    }
  }, [draft, unit]);

  const update = (field) => (e) => {
    setDraft((d) => ({ ...d, [field]: e.target.value }));
  };

  const bgValid = resolveColor(draft.bg_color);
  const fgValid = resolveColor(draft.text_color);
  const brValid = !draft.border_color || resolveColor(draft.border_color);
  const valid = bgValid && fgValid && brValid && draft.text && draft.width > 0 && draft.height > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <h3>Edit Nameplate #{draft.sr_no}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="form-group">
              <label>Text</label>
              <input type="text" value={draft.text} onChange={update('text')} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Width ({unit})</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={draft.width}
                  onChange={(e) => setDraft((d) => ({ ...d, width: Number(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label>Height ({unit})</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={draft.height}
                  onChange={(e) => setDraft((d) => ({ ...d, height: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Background Color</label>
              <div className="color-input-wrap">
                <input
                  type="text"
                  value={draft.bg_color}
                  onChange={update('bg_color')}
                  style={{ borderColor: bgValid ? undefined : '#dc2626' }}
                />
                <input
                  type="color"
                  value={bgValid || '#FFFFFF'}
                  onChange={update('bg_color')}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Text Color</label>
              <div className="color-input-wrap">
                <input
                  type="text"
                  value={draft.text_color}
                  onChange={update('text_color')}
                  style={{ borderColor: fgValid ? undefined : '#dc2626' }}
                />
                <input
                  type="color"
                  value={fgValid || '#000000'}
                  onChange={update('text_color')}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Border Style</label>
                <select
                  value={draft.border_style || 'single'}
                  onChange={update('border_style')}
                >
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
                  value={draft.corner_radius || 0}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, corner_radius: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

            {(draft.border_style === 'single' || draft.border_style === 'dashed') && (
              <div className="form-row">
                <div className="form-group">
                  <label>Border Color</label>
                  <div className="color-input-wrap">
                    <input
                      type="text"
                      value={draft.border_color || ''}
                      onChange={update('border_color')}
                      placeholder="(none)"
                    />
                    <input
                      type="color"
                      value={resolveColor(draft.border_color) || '#000000'}
                      onChange={update('border_color')}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Border (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.border_thickness || 0}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, border_thickness: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            )}

            {draft.border_style === 'double' && (
              <div style={{
                background: '#f0f7ff',
                border: '1px solid #cfe2f7',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#1f3864',
                  textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8,
                }}>
                  Double Border
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Outer Color</label>
                    <div className="color-input-wrap">
                      <input
                        type="text"
                        value={draft.outer_color || ''}
                        onChange={update('outer_color')}
                      />
                      <input
                        type="color"
                        value={resolveColor(draft.outer_color) || '#000000'}
                        onChange={update('outer_color')}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Outer (px)</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={draft.outer_thickness || 0}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, outer_thickness: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Gap (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={draft.gap || 0}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, gap: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Inner Color</label>
                    <div className="color-input-wrap">
                      <input
                        type="text"
                        value={draft.inner_color || ''}
                        onChange={update('inner_color')}
                      />
                      <input
                        type="color"
                        value={resolveColor(draft.inner_color) || '#FFFFFF'}
                        onChange={update('inner_color')}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Inner (px)</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={draft.inner_thickness || 0}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, inner_thickness: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Font Family</label>
                <select
                  value={draft.font_family || 'auto'}
                  onChange={update('font_family')}
                >
                  {getAvailableFonts().map((f) => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Font Size</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value={FONT_SIZES.includes(draft.font_size) || draft.font_size === 'auto' ? draft.font_size : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setDraft((d) => ({ ...d, font_size: e.target.value }));
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
                    value={draft.font_size === 'auto' ? '' : draft.font_size}
                    onChange={(e) => setDraft((d) => ({ ...d, font_size: e.target.value || 'auto' }))}
                    style={{ width: 70 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>
              Live Preview
            </label>
            <div
              className="preview-stage"
              style={{ minHeight: 300, marginTop: 8 }}
            >
              <canvas ref={previewRef} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(draft)}
            disabled={!valid}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
