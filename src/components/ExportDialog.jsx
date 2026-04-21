import { useState } from 'react';

export default function ExportDialog({ onSelect, onClose, singleFile = false }) {
  const [format, setFormat] = useState('png');

  const formats = [
    { value: 'png',  label: 'PNG',  desc: 'Lossless, supports transparency' },
    { value: 'jpg',  label: 'JPG',  desc: 'Smaller file, no transparency' },
    { value: 'webp', label: 'WEBP', desc: 'Modern, small & high quality' },
    { value: 'pdf',  label: 'PDF',  desc: 'Print-ready document' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{singleFile ? 'Download Nameplate' : 'Export All Nameplates'}</h3>
        <p className="muted mb-2">
          {singleFile
            ? 'Choose the image format for your download.'
            : 'Choose a format. All nameplates will be packaged into a single ZIP file.'}
        </p>

        <div className="form-group mt-3">
          <label>Format</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {formats.map((f) => (
              <label
                key={f.value}
                style={{
                  padding: 12,
                  border: `2px solid ${format === f.value ? '#2e75b6' : '#e5e7eb'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: format === f.value ? '#f0f7ff' : 'white',
                  display: 'block',
                }}
              >
                <input
                  type="radio"
                  name="format"
                  value={f.value}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                  style={{ marginRight: 8 }}
                />
                <strong>{f.label}</strong>
                <div className="muted" style={{ marginTop: 3, marginLeft: 22 }}>
                  {f.desc}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSelect(format)}>
            {singleFile ? 'Download' : 'Download ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
}
