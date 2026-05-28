export default function FormField({ label, required, error, help, children, style }) {
  return (
    <div style={{ marginBottom: "var(--space-4)", ...style }}>
      {label && (
        <label style={{
          display: "block",
          fontSize: "var(--font-size-sm)",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-1)",
          fontWeight: "var(--font-weight-semibold)",
        }}>
          {label}
          {required && <span style={{ color: "var(--color-danger)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {help && (
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-1)" }}>
          {help}
        </div>
      )}
      {error && (
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-danger)", marginTop: "var(--space-1)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 42,
  padding: "0 var(--space-3)",
  border: "1px solid var(--border-color)",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-surface-subtle)",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  fontSize: "var(--font-size-base)",
};

const focusStyle = {
  outline: "none",
  borderColor: "var(--color-primary)",
  background: "var(--bg-surface)",
  boxShadow: "0 0 0 2px rgba(59,130,246,0.1)",
};

export function Input(props) {
  return (
    <input
      style={inputStyle}
      onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
      onBlur={(e) => {
        e.currentTarget.style.outline = "";
        e.currentTarget.style.borderColor = "var(--border-color)";
        e.currentTarget.style.background = "var(--bg-surface-subtle)";
        e.currentTarget.style.boxShadow = "";
      }}
      {...props}
    />
  );
}

export function Select({ options, placeholder, ...props }) {
  return (
    <select
      style={{ ...inputStyle, cursor: "pointer" }}
      onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
      onBlur={(e) => {
        e.currentTarget.style.outline = "";
        e.currentTarget.style.borderColor = "var(--border-color)";
        e.currentTarget.style.background = "var(--bg-surface-subtle)";
        e.currentTarget.style.boxShadow = "";
      }}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export function Textarea(props) {
  return (
    <textarea
      style={{
        ...inputStyle,
        height: "auto",
        padding: "var(--space-2) var(--space-3)",
        resize: "vertical",
        minHeight: 60,
      }}
      onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
      onBlur={(e) => {
        e.currentTarget.style.outline = "";
        e.currentTarget.style.borderColor = "var(--border-color)";
        e.currentTarget.style.background = "var(--bg-surface-subtle)";
        e.currentTarget.style.boxShadow = "";
      }}
      {...props}
    />
  );
}
