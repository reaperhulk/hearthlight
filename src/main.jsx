import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.jsx';
import './ui/index.css';

// A crash must never eat the save: offer reload first, reset as last resort.
class Hearthguard extends Component {
  constructor(props) { super(props); this.state = { broken: false }; }
  static getDerivedStateFromError() { return { broken: true }; }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div className="crash-panel">
        <h1>The lantern flickered.</h1>
        <p>Something went wrong, but your vigils are safe.</p>
        <button onClick={() => window.location.reload()}>Relight</button>
        <button onClick={() => { window.localStorage.removeItem('hearthlight-save'); window.location.reload(); }}>
          Start over (wipes the save)
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Hearthguard>
      <App />
    </Hearthguard>
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
