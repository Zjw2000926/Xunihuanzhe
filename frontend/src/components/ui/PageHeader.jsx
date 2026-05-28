import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, subtitle, icon: Icon, actions, backTo, style }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        marginBottom: "var(--space-6)",
        ...style,
      }}
    >
      {backTo && (
        <div style={{ marginBottom: "var(--space-2)" }}>
          <span
            onClick={() => navigate(backTo)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--font-size-sm)",
              color: "var(--color-primary)",
              cursor: "pointer",
              fontWeight: "var(--font-weight-medium)",
            }}
          >
            <ChevronLeft size={14} />
            返回
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--font-size-xl)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--text-primary)",
            margin: 0,
          }}>
            {Icon && <Icon size={22} />}
            {title}
          </h1>
          {subtitle && (
            <p style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-secondary)",
              marginTop: "var(--space-1)",
              marginBottom: 0,
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
