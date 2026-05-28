import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, title, children, footer, maxWidth = 560, style }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        background: "var(--bg-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-xl)",
          ...style,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-5) var(--space-6)",
          borderBottom: "1px solid var(--border-color)",
        }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)", margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              display: "flex",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-subtle)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--text-tertiary)"; }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "var(--space-6)" }}>
          {children}
        </div>

        {footer && (
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-2)",
            padding: "var(--space-4) var(--space-6)",
            borderTop: "1px solid var(--border-color)",
            background: "var(--bg-surface-subtle)",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
