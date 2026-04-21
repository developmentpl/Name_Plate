import { useState } from 'react';
import ManualMode from './components/ManualMode.jsx';
import BulkMode from './components/BulkMode.jsx';

export default function App() {
  const [mode, setMode] = useState('manual');

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>NamePlate Generator</h1>
          <div className="subtitle">Design one or generate thousands — fully offline</div>
        </div>
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => setMode('manual')}
          >
            Manual
          </button>
          <button
            className={`mode-tab ${mode === 'bulk' ? 'active' : ''}`}
            onClick={() => setMode('bulk')}
          >
            Bulk
          </button>
        </div>
      </header>

      <main className="app-main">
        {mode === 'manual' ? <ManualMode /> : <BulkMode />}
      </main>

      <footer className="app-footer">
        NamePlate Generator v1.0 &middot; Client-side only &middot; Your data never leaves your machine
      </footer>
    </div>
  );
}
