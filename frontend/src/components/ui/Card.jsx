export default function Card({ title, titleIcon: TitleIcon, actions, children, style, className = "" }) {
  return (
    <div
      className={`card ${className}`}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-4) var(--space-5)",
            borderBottom: children ? "1px solid var(--border-color)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-md)", color: "var(--text-primary)" }}>
            {TitleIcon && <TitleIcon size={17} />}
            {title}
          </div>
          {actions && <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: "var(--space-5)" }}>{children}</div>
    </div>
  );
}
