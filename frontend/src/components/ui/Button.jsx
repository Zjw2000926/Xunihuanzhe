import { Loader2 } from "lucide-react";

const variantStyles = {
  primary: {
    base: { background: "var(--color-primary)", color: "#fff", border: "1px solid var(--color-primary)" },
    hover: { background: "var(--color-primary-hover)" },
  },
  secondary: {
    base: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-color)" },
    hover: { background: "var(--bg-surface-hover)" },
  },
  danger: {
    base: { background: "var(--color-danger)", color: "#fff", border: "1px solid var(--color-danger)" },
    hover: { background: "var(--color-danger-hover)" },
  },
  outline: {
    base: { background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-primary)" },
    hover: { background: "var(--color-primary-soft)" },
  },
  ghost: {
    base: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
    hover: { background: "var(--bg-surface-hover)", color: "var(--text-primary)" },
  },
};

const sizeStyles = {
  sm: { padding: "4px 10px", fontSize: "var(--font-size-sm)", height: "32px", borderRadius: "var(--radius-sm)" },
  md: { padding: "6px 16px", fontSize: "var(--font-size-base)", height: "38px", borderRadius: "var(--radius-md)" },
  lg: { padding: "10px 24px", fontSize: "var(--font-size-base)", height: "44px", borderRadius: "var(--radius-md)" },
};

export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  children,
  style,
  ...props
}) {
  const isDisabled = disabled || loading;
  const vs = variantStyles[variant] || variantStyles.primary;
  const ss = sizeStyles[size] || sizeStyles.md;

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontWeight: "var(--font-weight-medium)",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.55 : 1,
    transition: "background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)",
    whiteSpace: "nowrap",
    userSelect: "none",
    ...ss,
    ...vs.base,
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        if (!isDisabled) Object.assign(e.currentTarget.style, vs.hover);
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) Object.assign(e.currentTarget.style, vs.base);
      }}
      {...props}
    >
      {loading ? <Loader2 size={ss.fontSize === "var(--font-size-sm)" ? 13 : 15} className="spin" /> : Icon ? <Icon size={ss.fontSize === "var(--font-size-sm)" ? 13 : 15} /> : null}
      {children}
    </button>
  );
}
