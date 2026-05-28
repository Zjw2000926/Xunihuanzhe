import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("React Error Boundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", gap: 16,
          fontFamily: "system-ui, sans-serif", color: "#374151",
        }}>
          <h2 style={{ margin: 0 }}>页面出错了</h2>
          <p style={{ color: "#6b7280", margin: 0 }}>请刷新页面重试，如仍存在问题请联系管理员</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: "8px 24px", border: "none", borderRadius: 8,
              background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 14,
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
