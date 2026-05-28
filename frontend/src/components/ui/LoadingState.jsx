export default function LoadingState({ message = "加载中..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-12) var(--space-6)", textAlign: "center", color: "var(--text-tertiary)" }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, marginBottom: "var(--space-3)" }} />
      <span style={{ fontSize: "var(--font-size-base)" }}>{message}</span>
    </div>
  );
}
