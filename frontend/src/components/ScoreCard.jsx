import { useState } from "react";
import { X, CheckCircle, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

function ScoreBar({ label, score, max, variant }) {
  const pct = Math.min((score / max) * 100, 100);
  const colorMap = { blue: "#2563eb", teal: "#14b8a6" };
  const bgMap = { blue: "#eff6ff", teal: "#f0fdfa" };
  const color = colorMap[variant] || "#2563eb";
  const bg = bgMap[variant] || "#eff6ff";

  return (
    <div className="score-category-row" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: "0.88rem", fontWeight: 700, color }}>
          {score}<span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 400 }}> / {max}</span>
        </span>
      </div>
      <div className="score-bar" style={{ background: bg }}>
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function ScoreItem({ item }) {
  const [expanded, setExpanded] = useState(item.score < 2);
  const hasEvidence = item.evidence || item.reason;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => hasEvidence && setExpanded(!expanded)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "6px 10px", borderRadius: 6, cursor: hasEvidence ? "pointer" : "default",
          background: item.score >= 3 ? "#f0fdf4" : item.score >= 2 ? "#fffbeb" : "#fef2f2",
          transition: "background 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          {hasEvidence && (
            <span style={{ color: "#9ca3af", flexShrink: 0, transition: "transform 0.2s ease" }}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          )}
          <span style={{ fontSize: "0.76rem", color: "#374151", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
        </div>
        <span style={{
          fontSize: "0.72rem", fontWeight: 700, marginLeft: 8, flexShrink: 0,
          color: item.score >= 3 ? "#15803d" : item.score >= 2 ? "#b45309" : "#dc2626",
        }}>
          {item.score}/3
        </span>
      </div>
      <div
        style={{
          maxHeight: expanded && hasEvidence ? 200 : 0,
          opacity: expanded && hasEvidence ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease",
          margin: expanded && hasEvidence ? "2px 4px 4px 24px" : "0 4px 0 24px",
        }}
      >
        <div style={{
          padding: "8px 10px", borderRadius: 6,
          background: "#f8fafc", border: "1px solid #e5e7eb", fontSize: "0.73rem", lineHeight: 1.55,
        }}>
          {item.evidence && (
            <div style={{ marginBottom: item.reason ? 4 : 0 }}>
              <span style={{ fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                <MessageSquare size={10} /> 证据
              </span>
              <span style={{ color: "#374151" }}>{item.evidence}</span>
            </div>
          )}
          {item.reason && (
            <div>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>理由：</span>
              <span style={{ color: "#374151" }}>{item.reason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScoreCard({ score, onClose }) {
  if (!score) return null;

  const detailScores = score.detail_scores || {};
  const categories = Object.entries(detailScores);
  const isNewFormat = categories.length > 0 && categories[0][1] && typeof categories[0][1] === "object" && "items" in categories[0][1];

  let maxTotal = 100;
  if (isNewFormat) {
    maxTotal = categories.reduce((sum, [, v]) => sum + (v.max || 0), 0);
  }

  const rubricLabel = score.rubric_version
    ? (score.rubric_version.startsWith("legacy") ? "旧版评分标准" : `评分标准: ${score.rubric_version}`)
    : null;

  return (
    <div className="score-overlay" onClick={onClose}>
      <div
        className="score-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scoreSlideUp 0.25s ease" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>训练评分报告</h2>
            {rubricLabel && <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{rubricLabel}</span>}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="score-total">
          <div className="big-number">{score.total_score}</div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>总分 (满分{maxTotal})</div>
        </div>

        {isNewFormat ? (
          categories.map(([catName, catData]) => (
            <ScoreBar key={catName} label={catName} score={catData.score} max={catData.max}
              variant={catName.includes("沟通") ? "blue" : "teal"} />
          ))
        ) : (
          <div style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", marginBottom: 12 }}>
            旧版评分标准，仅总分有效
          </div>
        )}

        {isNewFormat && categories.map(([catName, catData]) => (
          <div key={catName} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {catName} · 逐项评分（点击展开证据）
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {catData.items.map((item, i) => (
                <ScoreItem key={item.id || i} item={item} />
              ))}
            </div>
          </div>
        ))}

        {score.strengths && score.strengths.length > 0 && (
          <div className="score-section">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckCircle size={16} color="#22c55e" />表现较好</h4>
            <ul>{score.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}

        {score.weaknesses && score.weaknesses.length > 0 && (
          <div className="score-section">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={16} color="#f59e0b" />需要改善</h4>
            <ul>{score.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        {score.missed_content && score.missed_content.length > 0 && (
          <div className="score-section">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={16} color="#ef4444" />漏问内容</h4>
            <ul>{score.missed_content.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}

        {score.suggestions && (
          <div className="score-section">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}><Lightbulb size={16} color="#2563eb" />改进建议</h4>
            <div className="text-block">{score.suggestions}</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scoreSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
