import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let _nextId = 0;

const icons = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const colors = {
  success: { bg: "#f0fdf4", border: "#86efac", text: "#166534", icon: "#16a34a" },
  error: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", icon: "#dc2626" },
  warning: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", icon: "#d97706" },
  info: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", icon: "#2563eb" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const toast = useCallback(
    (message, type = "info", duration = 4000) => {
      const id = ++_nextId;
      setToasts((prev) => {
        if (prev.length >= 5) return prev; // 最多5个
        return [
          ...prev,
          { id, message, type, duration, entering: true },
        ];
      });
      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => remove(id), duration);
      }
      return id;
    },
    [remove],
  );

  // 便捷方法
  const success = useCallback((msg) => toast(msg, "success"), [toast]);
  const error = useCallback((msg) => toast(msg, "error", 6000), [toast]);
  const warning = useCallback((msg) => toast(msg, "warning", 5000), [toast]);
  const info = useCallback((msg) => toast(msg, "info"), [toast]);

  // 清除进入动画
  useEffect(() => {
    const ids = [];
    toasts.forEach((t) => {
      if (t.entering) {
        ids.push(t.id);
      }
    });
    if (ids.length > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (ids.includes(t.id) ? { ...t, entering: false } : t)),
        );
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} ${t.entering ? "toast-entering" : ""}`}
            style={{
              background: colors[t.type].bg,
              borderColor: colors[t.type].border,
            }}
          >
            <span style={{ color: colors[t.type].icon, display: "flex", flexShrink: 0 }}>
              {icons[t.type]}
            </span>
            <span style={{ color: colors[t.type].text, fontSize: "0.84rem", fontWeight: 500, flex: 1 }}>
              {t.message}
            </span>
            <button className="toast-close" onClick={() => remove(t.id)}>
              <X size={14} />
            </button>
            {t.duration > 0 && (
              <div
                className="toast-progress"
                style={{
                  animationDuration: `${t.duration}ms`,
                  background: colors[t.type].border,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
