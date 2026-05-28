const colorMap = {
  blue: { bg: "var(--color-primary-soft)", color: "var(--color-primary)" },
  green: { bg: "var(--color-success-soft)", color: "var(--color-success)" },
  amber: { bg: "var(--color-warning-soft)", color: "var(--color-warning)" },
  red: { bg: "var(--color-danger-soft)", color: "var(--color-danger)" },
  teal: { bg: "var(--color-clinical-soft)", color: "var(--color-clinical)" },
};

export default function StatCard({ icon: Icon, value, label, color = "blue", trend, onClick, style }) {
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4) var(--space-5)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        cursor: onClick ? "pointer" : undefined,
        transition: "box-shadow var(--transition-fast), border-color var(--transition-fast)",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = "var(--color-primary-border)";
          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = "var(--border-color)";
          e.currentTarget.style.boxShadow = "";
        }
      }}
    >
      {Icon && (
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          background: c.bg,
          color: c.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={20} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: "var(--font-size-xl)",
          fontWeight: "var(--font-weight-bold)",
          lineHeight: 1.2,
          color: "var(--text-primary)",
        }}>
          {value ?? "-"}
        </div>
        <div style={{
          fontSize: "var(--font-size-sm)",
          color: "var(--text-secondary)",
          marginTop: 2,
        }}>
          {label}
        </div>
        {trend && (
          <div style={{
            fontSize: "var(--font-size-xs)",
            color: trend > 0 ? "var(--color-success)" : trend < 0 ? "var(--color-danger)" : "var(--text-tertiary)",
            marginTop: 2,
            fontWeight: "var(--font-weight-medium)",
          }}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}
