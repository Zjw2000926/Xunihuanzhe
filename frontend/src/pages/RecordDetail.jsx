import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BarChart3, ClipboardList, Clock, Download, FileText, MessageCircle, RefreshCw, User, ShieldCheck, Edit3, X, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { getRecordDetail, exportRecordDetail, retryScoring, getScoreReview, submitScoreReview } from "../api";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import ScoreCard from "../components/ScoreCard";
import { useToast } from "../components/Toast";
import Badge from "../components/ui/Badge";

function ReviewItem({ item, editedScore, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const hasEvidence = item.evidence || item.reason;
  const currentScore = editedScore !== undefined ? editedScore : item.score;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 12px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb",
        flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "#374151" }}>{item.name}</span>
            {hasEvidence && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "#9ca3af", display: "flex" }}
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>AI 评分: </span>
            <span style={{
              fontSize: "0.72rem", fontWeight: 700,
              color: item.score >= 3 ? "#15803d" : item.score >= 2 ? "#b45309" : "#dc2626",
            }}>
              {item.score}/3
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => onChange(item.id, s)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: currentScore === s ? "2px solid #2563eb" : "1px solid #d1d5db",
                background: currentScore === s ? "#eff6ff" : "#fff",
                color: currentScore === s ? "#2563eb" : "#6b7280",
                fontWeight: currentScore === s ? 700 : 500, fontSize: "0.8rem",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {expanded && hasEvidence && (
        <div style={{
          margin: "2px 4px 4px 12px", padding: "8px 10px", borderRadius: 6,
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
      )}
    </div>
  );
}

function ReviewEditor({ score, review, onSubmit, onClose, submitting }) {
  const detailScores = score?.detail_scores || {};
  const [comment, setComment] = useState(review?.review_comment || "");
  const [editedScores, setEditedScores] = useState(() => {
    const initial = {};
    for (const [, catData] of Object.entries(detailScores)) {
      if (catData && typeof catData === "object" && "items" in catData) {
        for (const item of catData.items) {
          initial[item.id] = item.score;
        }
      }
    }
    return initial;
  });

  const categories = Object.entries(detailScores);
  const isNewFormat = categories.length > 0 && categories[0][1] && typeof categories[0][1] === "object" && "items" in categories[0][1];

  const handleScoreChange = (itemId, newScore) => {
    setEditedScores((prev) => ({ ...prev, [itemId]: newScore }));
  };

  const handleSubmit = () => {
    const modified = JSON.parse(JSON.stringify(detailScores));
    for (const [, catData] of Object.entries(modified)) {
      if (catData && typeof catData === "object" && "items" in catData) {
        let catTotal = 0;
        for (const item of catData.items) {
          if (editedScores[item.id] !== undefined) {
            item.score = editedScores[item.id];
          }
          catTotal += item.score;
        }
        catData.score = catTotal;
      }
    }
    onSubmit(modified, comment);
  };

  return (
    <div className="score-overlay" onClick={onClose}>
      <div className="score-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>教师复核评分</h2>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>逐项审核 AI 评分，可修改每项分值</span>
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

        {isNewFormat ? (
          categories.map(([catName, catData]) => (
            <div key={catName} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 8,
              }}>
                {catName}（{catData.score}/{catData.max}）
              </div>
              {catData.items.map((item) => (
                <ReviewItem
                  key={item.id}
                  item={item}
                  editedScore={editedScores[item.id]}
                  onChange={handleScoreChange}
                />
              ))}
            </div>
          ))
        ) : (
          <div style={{ fontSize: "0.85rem", color: "#6b7280", padding: 16, textAlign: "center" }}>
            此评分为旧版格式，不支持逐项修改。如需复核，请重新触发评分。
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
            复核备注
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="可选：对评分调整的说明..."
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db",
              fontSize: "0.82rem", resize: "vertical", fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn btn-outline" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "提交复核"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordDetail({ user, onLogout }) {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [review, setReview] = useState(null);
  const [showReviewEditor, setShowReviewEditor] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    loadRecord();
  }, [id, navigate]);

  useEffect(() => {
    if (record?.score) {
      loadReview();
    }
  }, [record?.score]);

  const loadRecord = async () => {
    try {
      const { data } = await getRecordDetail(id);
      setRecord(data);
    } catch {
      toast.error("加载记录详情失败");
      navigate("/history");
    }
  };

  const loadReview = async () => {
    try {
      const { data } = await getScoreReview(id);
      setReview(data);
    } catch {
      setReview(null);
    }
  };

  const isReviewed = review?.review_status === "reviewed";
  const isTeacher = user?.role === "teacher";

  const handleRetryScoring = async () => {
    setRetrying(true);
    try {
      await retryScoring(id);
      toast.info("评分已重新触发，请稍后刷新查看结果");
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data } = await getRecordDetail(id);
        if (data.scoring_status === "completed" && data.score) {
          setRecord(data);
          toast.success("评分已完成");
          break;
        }
        if (data.scoring_status === "failed") {
          setRecord(data);
          toast.error("评分再次失败: " + (data.scoring_error || "未知错误"));
          break;
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "重试评分失败");
    } finally {
      setRetrying(false);
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await exportRecordDetail(id);
      const url = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `record_${id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("导出失败"); }
  };

  const handleSubmitReview = async (modifiedScores, comment) => {
    setSubmittingReview(true);
    try {
      await submitScoreReview(id, {
        detail_scores: modifiedScores,
        comment,
      });
      toast.success("复核已提交");
      setShowReviewEditor(false);
      await loadRecord();
      await loadReview();
    } catch (err) {
      toast.error(err.response?.data?.detail || "提交复核失败");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!record) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="empty-state">加载中...</div>
      </Layout>
    );
  }

  const duration = record.end_time
    ? Math.round((new Date(record.end_time) - new Date(record.start_time)) / 60000)
    : null;
  const isLegacyScore = record.score?.rubric_version?.startsWith("legacy");
  const scoreMax = isLegacyScore
    ? 100
    : record.score?.detail_scores
    ? Object.values(record.score.detail_scores).reduce((sum, value) => {
        if (value && typeof value === "object" && "max" in value) return sum + (value.max || 0);
        return sum + 30;
      }, 0)
    : 100;

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title="记录详情"
        subtitle={`训练记录 #${record.id}`}
        icon={FileText}
        backTo="/history"
      />

      {/* 元信息 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><User size={22} /></div>
          <div>
            <div className="stat-value" style={{ fontSize: "1rem" }}>{record.user_display_name}</div>
            <div className="stat-label">学生</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><ClipboardList size={22} /></div>
          <div>
            <div className="stat-value" style={{ fontSize: "1rem" }}>{record.case_name}</div>
            <div className="stat-label">病例</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={22} /></div>
          <div>
            <div className="stat-value">{duration != null ? `${duration}分钟` : "-"}</div>
            <div className="stat-label">训练时长</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><BarChart3 size={22} /></div>
          <div>
            <div className="stat-value">{record.score?.total_score ?? "-"}</div>
            <div className="stat-label">得分</div>
          </div>
        </div>
      </div>

      {/* 评分状态 */}
      {record.status === "completed" && !record.score && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--amber-300)", background: "var(--amber-50)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ color: "var(--amber-700)" }}>
                {record.scoring_status === "pending" || record.scoring_status === "processing"
                  ? "评分正在生成中..." : "暂无评分"}
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--amber-700)", marginTop: 4 }}>
                {record.scoring_status === "pending" || record.scoring_status === "processing"
                  ? "AI 正在分析对话内容，预计几秒到一分钟内完成。" :
                  record.scoring_status === "failed"
                    ? `评分失败: ${record.scoring_error || "未知错误"}` :
                    "评分尚未生成"}
              </p>
            </div>
            {record.scoring_status === "failed" && (
              <button className="btn btn-primary btn-sm" onClick={handleRetryScoring} disabled={retrying}>
                <RefreshCw size={14} className={retrying ? "spin" : ""} />
                <span>{retrying ? "重试中..." : "重新评分"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 评分摘要 */}
      {record.score && (
        <div className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg, #eef2ff, #f0f9ff)", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>评分结果</h3>
              {isReviewed ? (
                <Badge variant="success">
                  <ShieldCheck size={12} /> 教师已复核
                </Badge>
              ) : (
                <Badge variant="info">AI 初评</Badge>
              )}
              {isReviewed && review?.reviewed_by_name && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                  复核人: {review.reviewed_by_name}
                  {review.reviewed_at && ` · ${new Date(review.reviewed_at).toLocaleDateString("zh-CN")}`}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {isTeacher && (
                <button className="btn btn-sm btn-outline" onClick={() => setShowReviewEditor(true)}>
                  <Edit3 size={14} /> {isReviewed ? "修改复核" : "复核评分"}
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={() => setShowScore(true)}>查看详细评分</button>
              <button className="btn btn-sm btn-outline" onClick={handleExport}><Download size={14} />导出记录</button>
            </div>
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--primary)" }}>
            {record.score.total_score}
            <span style={{ fontSize: "1rem", color: "var(--text-secondary)", fontWeight: 400 }}> / {scoreMax}分</span>
          </div>
          {isReviewed && review?.review_comment && (
            <div style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.7)",
              fontSize: "0.78rem", color: "#374151", border: "1px solid #e5e7eb",
            }}>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>复核备注：</span>
              {review.review_comment}
            </div>
          )}
        </div>
      )}

      {/* 对话回放 */}
      <div className="card">
        <div className="card-header"><h3><MessageCircle size={18} />对话回放 ({record.messages.length}条消息)</h3></div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: 20, maxHeight: 400, overflowY: "auto" }}>
          {record.messages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: 10, fontSize: "0.875rem", lineHeight: 1.6 }}>
              <span style={{
                fontWeight: 600,
                color: msg.role === "student" ? "var(--primary)" : "#0d9488",
                marginRight: 8,
              }}>
                {msg.role === "student" ? "学生：" : "患者："}
              </span>
              <span>{msg.content}</span>
            </div>
          ))}
        </div>
      </div>

      {showScore && record.score && <ScoreCard score={record.score} onClose={() => setShowScore(false)} />}

      {showReviewEditor && (
        <ReviewEditor
          score={record.score}
          review={review}
          onSubmit={handleSubmitReview}
          onClose={() => setShowReviewEditor(false)}
          submitting={submittingReview}
        />
      )}
    </Layout>
  );
}
