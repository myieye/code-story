import './app.css';
import { Component, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

/** Review state lives on the server, so after a render crash a reload loses nothing — say so. */
class CrashScreen extends Component<{ children: ReactNode }, { error?: unknown }> {
  override state: { error?: unknown } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override render() {
    if (this.state.error === undefined) return this.props.children;
    return (
      <main className="notice">
        <h1>code-story</h1>
        <p>The book UI crashed: {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}</p>
        <p>Your review marks are saved on the daemon — reload to continue where you left off.</p>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashScreen>
      <App />
    </CrashScreen>
  </StrictMode>,
);
