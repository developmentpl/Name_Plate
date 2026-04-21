import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/app.css';
import { loadFonts } from './utils/fontLoader.js';

// Start loading Google Fonts (Noto Sans + Noto Sans Devanagari) right away.
// The app renders immediately; fonts become available within 1-2 seconds.
loadFonts();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
