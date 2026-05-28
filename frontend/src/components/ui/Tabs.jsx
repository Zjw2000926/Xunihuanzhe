export default function Tabs({ tabs, activeTab, onChange, style }) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        marginBottom: "var(--space-5)",
        gap: 0,
        ...style,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: "var(--space-3) var(--space-5)",
            border: "none",
            background: "none",
            fontSize: "var(--font-size-base)",
            fontWeight: activeTab === tab.key ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
            color: activeTab === tab.key ? "var(--color-primary)" : "var(--text-secondary)",
            cursor: "pointer",
            borderBottom: activeTab === tab.key ? "2px solid var(--color-primary)" : "2px solid transparent",
            marginBottom: -1,
            fontFamily: "inherit",
            transition: "color var(--transition-fast), border-color var(--transition-fast)",
            whiteSpace: "nowrap",
          }}
        >
          {tab.icon && <tab.icon size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}
          {tab.label}
          {tab.count != null && (
            <span style={{
              marginLeft: 6,
              padding: "1px 7px",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-semibold)",
              background: activeTab === tab.key ? "var(--color-primary-soft)" : "var(--bg-surface-subtle)",
              color: activeTab === tab.key ? "var(--color-primary)" : "var(--text-tertiary)",
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
