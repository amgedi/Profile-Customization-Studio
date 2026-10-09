import { Component, type ReactNode } from "react";

/**
 * React error boundaries around risky optional subsystems (R52). A failing
 * workspace / ambience / GitHub widget shows a localized fallback — never a
 * blank application. "Open Safe Mode" flips a session-level UI-safe flag and
 * reloads: chrome effects off, defaults applied (R53/R54).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; label: string; onHome?: () => void },
  { err: Error | null }
> {
  state = { err: null as Error | null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error) {
    // R98: timestamp + component + message; no project content.
    console.error(`[pcs ${new Date().toISOString()}] ${this.props.label}:`, err.message);
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="ws-error" role="alert">
        <h2>This workspace hit an error.</h2>
        <p className="paint-hint">{this.props.label} — the rest of the Studio is still running.</p>
        <div className="dialog-actions" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn primary" onClick={() => this.setState({ err: null })}>Retry</button>
          {this.props.onHome && (
            <button className="btn" onClick={() => { this.setState({ err: null }); this.props.onHome?.(); }}>Return Home</button>
          )}
          <button
            className="btn"
            onClick={() => {
              try { sessionStorage.setItem("pcs-safe-ui", "1"); } catch { /* ignore */ }
              window.location.reload();
            }}
          >
            Open Safe Mode
          </button>
        </div>
      </div>
    );
  }
}
