export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-12) var(--space-6)", textAlign: "center" }}>
      {Icon && (
        <div style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-3)" }}>
          <Icon size={40} strokeWidth={1.5} />
        </div>
      )}
      {title && <div style={{ fontSize: "var(--font-size-md)", fontWeight: "var(--font-weight-semibold)", color: "var(--text-primary)", marginBottom: "var(--space-1)" }}>{title}</div>}
      {description && <div style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)", maxWidth: 360, lineHeight: "var(--line-height-relaxed)", marginBottom: action ? "var(--space-4)" : 0 }}>{description}</div>}
      {action && <div>{action}</div>}
    </div>
  );
}
