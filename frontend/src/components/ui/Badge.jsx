const variantStyles = {
  success: { background: "var(--color-success-soft)", color: "var(--color-success)", border: "1px solid var(--color-success-border)" },
  info: { background: "var(--color-primary-soft)", color: "var(--color-primary)", border: "1px solid var(--color-primary-border)" },
  warning: { background: "var(--color-warning-soft)", color: "var(--color-warning)", border: "1px solid var(--color-warning-border)" },
  danger: { background: "var(--color-danger-soft)", color: "var(--color-danger)", border: "1px solid var(--color-danger-border)" },
  neutral: { background: "var(--bg-surface-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" },
};

export default function Badge({ variant = "neutral", children, style }) {
  const vs = variantStyles[variant] || variantStyles.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        fontSize: "var(--font-size-sm)",
        fontWeight: "var(--font-weight-medium)",
        borderRadius: "var(--radius-full)",
        whiteSpace: "nowrap",
        ...vs,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
