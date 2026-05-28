import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Drawer({ open, onClose, title, children, width = 360, position = "right" }) {
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

  const isRight = position === "right";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        background: "var(--bg-overlay)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [isRight ? "right" : "left"]: 0,
          width: `min(${width}px, 100vw)`,
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          animation: `drawer-slide-${position} 0.2s ease-out`,
        }}
      >
        <style>{`
          @keyframes drawer-slide-right {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes drawer-slide-left {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--border-color)",
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: "var(--font-size-md)", fontWeight: "var(--font-weight-semibold)", margin: 0 }}>
            {title}
          </h3>
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
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
