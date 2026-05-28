export default function Table({ columns, data, rowKey, emptyState, onRowClick, style }) {
  if (!data || data.length === 0) {
    if (emptyState) return <div style={{ padding: "var(--space-8)", textAlign: "center" }}>{emptyState}</div>;
    return (
      <div style={{ padding: "var(--space-12) var(--space-6)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-base)" }}>
        暂无数据
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", ...style }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--font-size-base)",
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: "left",
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--bg-surface-subtle)",
                  color: "var(--text-secondary)",
                  fontWeight: "var(--font-weight-semibold)",
                  fontSize: "var(--font-size-sm)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  borderBottom: "1px solid var(--border-color)",
                  whiteSpace: "nowrap",
                  width: col.width,
                  ...col.headerStyle,
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={rowKey ? row[rowKey] : i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                cursor: onRowClick ? "pointer" : undefined,
                transition: "background var(--transition-fast)",
                borderBottom: "1px solid var(--border-color)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    color: "var(--text-primary)",
                    lineHeight: "var(--line-height-normal)",
                    ...col.cellStyle,
                  }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
