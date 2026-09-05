import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Village } from "./ui/Village.jsx";
import "./ui/village.css";

// A crash must never eat the save: offer reload first, reset as last resort.
class Hearthguard extends Component {
  constructor(props) {
    super(props);
    this.state = { broken: false };
  }
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div className="crash-panel">
        <h1>The lantern flickered.</h1>
        <p>
          Something went wrong. Reload, or restore the previous automatic save.
        </p>
        <button onClick={() => window.location.reload()}>Relight</button>
        <button
          onClick={() => {
            try {
              const recovery = window.localStorage.getItem(
                "hearthlight-save-recovery",
              );
              if (recovery) {
                window.localStorage.setItem("hearthlight-save", recovery);
                window.location.reload();
              }
            } catch {
              /* Leave the original save intact when storage is unavailable. */
            }
          }}
        >
          Restore previous save
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Hearthguard>
      <Village />
    </Hearthguard>
  </StrictMode>,
);

// Offline vigil: the installed PWA opens without a network. Relative path
// keeps the GitHub Pages subpath working; dev stays uncached.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // No service worker is a degraded install, not a broken game.
    });
  });
}
