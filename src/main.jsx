import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.jsx';
import './ui/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline vigil: the installed PWA opens without a network. Relative path
// keeps the GitHub Pages subpath working; dev stays uncached.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No service worker is a degraded install, not a broken game.
    });
  });
}
