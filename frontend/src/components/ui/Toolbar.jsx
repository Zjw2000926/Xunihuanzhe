export default function Toolbar({ children, style }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
        flexWrap: "wrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ToolbarLeft({ children, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", ...style }}>
      {children}
    </div>
  );
}

export function ToolbarRight({ children, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", ...style }}>
      {children}
    </div>
  );
}
