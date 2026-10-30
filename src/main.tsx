import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Un imprévu est survenu.</h1>
        <p>
          La dernière sauvegarde locale est conservée. Rechargez l’application
          pour la retrouver.
        </p>
        <button onClick={() => location.reload()}>Recharger Clair</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
