import { Component, ReactNode } from "react";

interface State {
  error: Error | null;
  info: string | null;
}

// Global error boundary so a crash anywhere in the tree shows a real
// message instead of a blank page (which is what React renders by default
// when a render throws). Used at the very top of App so even crashes inside
// providers (Auth, Language, Notifications) are surfaced.
export default class GlobalErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: error.stack ?? error.message };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error("[GlobalErrorBoundary]", error, errorInfo);
  }

  reload = () => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F0FF",
          color: "#1a1a1a",
          padding: "24px 16px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 640, width: "100%" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#7c3aed" }}>
            Shinely — algo deu errado
          </h1>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>
            O app encontrou um erro ao carregar. Tira print desta tela e mande para o suporte
            para a gente corrigir.
          </p>
          <pre
            style={{
              background: "#fff",
              border: "1px solid #e5d8fb",
              borderRadius: 12,
              padding: 12,
              fontSize: 11,
              lineHeight: 1.4,
              maxHeight: 280,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "#b91c1c",
            }}
          >
            {this.state.error.message}
            {this.state.info && this.state.info !== this.state.error.message
              ? "\n\n" + this.state.info
              : ""}
          </pre>
          <button
            onClick={this.reload}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 12,
              background: "#7c3aed",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            Limpar dados e tentar novamente
          </button>
        </div>
      </div>
    );
  }
}
