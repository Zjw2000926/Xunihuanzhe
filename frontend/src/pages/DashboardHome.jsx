import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stethoscope, BarChart3, ClipboardList, MessageCircle, Star,
  Users, CheckCircle, Clock, Target, Settings, Download,
  TrendingUp, Award, ArrowRight, Play, BookOpen,
} from "lucide-react";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import TrainingDurationChart from "../components/TrainingDurationChart";
import { getCases, getRecords, getStats, getDurationStats, exportRecords } from "../api";
import { useToast } from "../components/Toast";

const QUICK_QA_HINTS = [
  "如何询问患者既往病史？",
  "糖尿病患者病史采集重点是什么？",
  "如何评估疼痛程度？",
];

export default function DashboardHome({ user, onLogout }) {
  const [cases, setCases] = useState([]);
  const [records, setRecords] = useState([]);
  const [durationStats, setDurationStats] = useState(null);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (user?.role === "student") {
      getCases().then(({ data }) => setCases(data)).catch(() => toast.error("加载病例列表失败"));
      getDurationStats().then(({ data }) => setDurationStats(data)).catch(() => toast.error("加载统计失败"));
    }
    if (user?.role === "teacher") {
      getStats().then(({ data }) => setStats(data)).catch(() => toast.error("加载管理统计失败"));
    }
    getRecords()
      .then(({ data }) => setRecords(data || []))
      .catch(() => toast.error("加载训练记录失败"));
  }, [user]);

  const handleExport = async () => {
    try {
      const { data } = await exportRecords();
      const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `training_records_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    } catch { toast.error("导出失败"); }
  };

  if (user?.role === "teacher") {
    return <TeacherDashboard user={user} onLogout={onLogout} stats={stats} records={records} handleExport={handleExport} navigate={navigate} />;
  }

  return <StudentDashboard user={user} onLogout={onLogout} cases={cases} records={records} durationStats={durationStats} navigate={navigate} />;
}

// ═══════════════════════════════════════════
// 学生端工作台
// ═══════════════════════════════════════════

function StudentDashboard({ user, onLogout, cases, records, durationStats, navigate }) {
  const inProgressRecord = records.find((r) => r.status === "in_progress");
  const latestCompleted = records.find((r) => r.status === "completed" && r.score_total != null);
  const completedCount = records.filter((r) => r.status === "completed").length;
  const latestScore = latestCompleted?.score_total;

  const scoreGrade = latestScore != null
    ? latestScore >= 85 ? { label: "优秀", color: "green" }
      : latestScore >= 70 ? { label: "良好", color: "blue" }
      : latestScore >= 60 ? { label: "一般", color: "amber" }
      : { label: "待提高", color: "red" }
    : null;

  const recentCases = cases.slice(0, 3);

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title={`欢迎回来，${user?.display_name || "同学"}`}
        subtitle="选择病例，开始护理病史采集训练"
        actions={
          <button
            className="btn btn-primary"
            style={{ padding: "var(--space-3) var(--space-6)", fontSize: "var(--font-size-md)", fontWeight: 600 }}
            onClick={() => inProgressRecord ? navigate(`/training/${inProgressRecord.id}`) : navigate("/cases")}
          >
            {inProgressRecord ? <><Play size={16} />继续训练</> : <><Stethoscope size={16} />开始训练</>}
          </button>
        }
      />

      {/* 状态栏 */}
      <div className="hub-status-bar">
        <div className="hub-status-item">
          <span className="hub-status-value">{records.length}</span>
          <span className="hub-status-label">训练总次数</span>
        </div>
        <div className="hub-status-item">
          <span className="hub-status-value">{completedCount}</span>
          <span className="hub-status-label">已完成</span>
        </div>
        <div className="hub-status-item">
          <span className="hub-status-value">{durationStats?.total_minutes ?? 0}</span>
          <span className="hub-status-label">累计分钟</span>
        </div>
        <div className="hub-status-item">
          <span className="hub-status-value" style={{ color: latestScore != null ? "var(--color-primary)" : "var(--text-tertiary)" }}>
            {latestScore != null ? `${latestScore}分` : "-"}
          </span>
          <span className="hub-status-label">
            最新得分
            {scoreGrade && <Badge variant={scoreGrade.color} style={{ marginLeft: 6, fontSize: "0.6rem" }}>{scoreGrade.label}</Badge>}
          </span>
        </div>
      </div>

      {/* 两列布局 */}
      <div className="dashboard-grid">
        {/* 左列：主要内容 */}
        <div className="dashboard-main">
          {/* 训练行动区 */}
          <div className="training-hero">
            <div className="hero-icon-wrap"><Stethoscope size={40} /></div>
            <div className="training-hero-title">
              {inProgressRecord ? "继续进行中的训练" : "开始新的病史采集训练"}
            </div>
            <div className="training-hero-desc">
              {inProgressRecord
                ? "你有一个进行中的训练，点击下方按钮继续。"
                : "选择虚拟患者，系统模拟真实护理问诊场景，训练结束后自动评分并提供反馈。"}
            </div>
            <div className="hero-case-tag">
              <BookOpen size={14} /> 病例库：{cases.length} 例可用
            </div>
            <button
              className="hero-start-btn"
              onClick={() => inProgressRecord ? navigate(`/training/${inProgressRecord.id}`) : navigate("/cases")}
            >
              {inProgressRecord ? "继续训练 →" : "选择病例开始训练 →"}
            </button>
            {!inProgressRecord && <div className="hero-hint">约 20 分钟完成一次训练</div>}
          </div>

          {/* 推荐病例 */}
          {recentCases.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3><BookOpen size={17} />推荐病例</h3>
                <span className="link" onClick={() => navigate("/cases")}>查看全部 →</span>
              </div>
              <div className="case-pick-list">
                {recentCases.map((c) => {
                  const p = c.patient_summary || {};
                  const d = c.difficulty || 1;
                  return (
                    <div
                      key={c.id}
                      className="case-pick-item"
                      onClick={() => navigate("/cases")}
                    >
                      <div className="case-pick-avatar">
                        <Stethoscope size={16} />
                      </div>
                      <div className="case-pick-info">
                        <div className="case-pick-name">
                          {c.name}
                          <span className={`difficulty-badge d-${d}`} style={{ marginLeft: 8 }}>
                            {"★".repeat(d)}{"☆".repeat(3 - d)}
                          </span>
                        </div>
                        <div className="case-pick-meta">
                          {p.gender} · {p.age}岁 · {p.chief_complaint || "查看详情"}
                        </div>
                      </div>
                      <ArrowRight size={14} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 最近训练记录 */}
          {records.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3><ClipboardList size={17} />最近训练记录</h3>
                <span className="link" onClick={() => navigate("/history")}>查看全部 →</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>病例</th><th>时间</th><th>状态</th><th>得分</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td>{r.case_name}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {new Date(r.start_time).toLocaleDateString("zh-CN")}
                      </td>
                      <td>
                        <span className={`badge ${r.status === "completed" ? "badge-success" : "badge-info"}`}>
                          {r.status === "completed" ? "已完成" : "进行中"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: r.score_total != null ? "var(--color-primary)" : "var(--text-tertiary)" }}>
                        {r.score_total != null ? `${r.score_total}分` : "-"}
                      </td>
                      <td>
                        <span className="link" onClick={() => navigate(`/record/${r.id}`)}>详情</span>
                        {r.status === "in_progress" && (
                          <span className="link" style={{ marginLeft: 12 }} onClick={() => navigate(`/training/${r.id}`)}>继续训练</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 右列：信息面板 */}
        <div className="dashboard-side">
          {/* 最新反馈 */}
          <div className="side-card">
            <div className="side-card-head">
              <h3><Award size={14} style={{ marginRight: 6 }} />最新反馈</h3>
            </div>
            {latestCompleted ? (
              <>
                <div className="feedback-mini-row">
                  <span className="feedback-mini-case">{latestCompleted.case_name}</span>
                  <span className="feedback-mini-date">
                    {new Date(latestCompleted.start_time).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="feedback-mini-score-row">
                  <span className="feedback-mini-big">{latestCompleted.score_total}</span>
                  <span className="feedback-mini-unit">分</span>
                  <span className={`feedback-mini-tag ${latestCompleted.score_total >= 70 ? "good" : "warn"}`}>
                    {latestCompleted.score_total >= 85 ? "优秀" : latestCompleted.score_total >= 70 ? "良好" : latestCompleted.score_total >= 60 ? "一般" : "待提高"}
                  </span>
                </div>
                <div className="feedback-mini-grid">
                  <div className="feedback-mini-item">
                    <span className="feedback-mini-k">沟通技能</span>
                    <span className="feedback-mini-v" style={{ color: "var(--blue-600)" }}>
                      {latestCompleted.score?.detail_scores?.["沟通技能"]?.score ?? "-"}
                      <span style={{ fontSize: "0.64rem", color: "var(--text-tertiary)" }}>
                        /{latestCompleted.score?.detail_scores?.["沟通技能"]?.max ?? "?"}
                      </span>
                    </span>
                  </div>
                  <div className="feedback-mini-item">
                    <span className="feedback-mini-k">病史采集</span>
                    <span className="feedback-mini-v" style={{ color: "var(--teal-600)" }}>
                      {latestCompleted.score?.detail_scores?.["病史采集"]?.score ?? "-"}
                      <span style={{ fontSize: "0.64rem", color: "var(--text-tertiary)" }}>
                        /{latestCompleted.score?.detail_scores?.["病史采集"]?.max ?? "?"}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="feedback-mini-list">
                  {latestCompleted.score?.strengths?.slice(0, 1).map((s, i) => (
                    <div key={i} className="feedback-mini-plus">+ {s}</div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/record/${latestCompleted.id}`)}>
                    查看完整报告
                  </button>
                </div>
              </>
            ) : (
              <div className="feedback-empty">
                <Target size={18} />
                <div>
                  <strong>还没有训练记录</strong>
                  <span>完成第一次病史采集训练后，这里将显示你的评分结果和改进建议。</span>
                  <button onClick={() => navigate("/cases")}>去训练 →</button>
                </div>
              </div>
            )}
          </div>

          {/* 快速提问 */}
          <div className="side-card">
            <div className="side-card-head">
              <h3><MessageCircle size={14} style={{ marginRight: 6 }} />快速提问</h3>
            </div>
            <div className="qa-quick-row">
              <input
                placeholder="输入护理专业问题..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    navigate(`/qa?q=${encodeURIComponent(e.target.value.trim())}`);
                  }
                }}
              />
              <button onClick={() => {
                const el = document.querySelector(".qa-quick-row input");
                if (el?.value.trim()) navigate(`/qa?q=${encodeURIComponent(el.value.trim())}`);
              }}>
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="qa-quick-hints">
              {QUICK_QA_HINTS.map((h, i) => (
                <span key={i} onClick={() => navigate(`/qa?q=${encodeURIComponent(h)}`)}>{h}</span>
              ))}
            </div>
          </div>

          {/* 本周统计 */}
          <div className="side-card">
            <div className="side-card-head">
              <h3><TrendingUp size={14} style={{ marginRight: 6 }} />本周训练</h3>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 0", background: "var(--bg-surface-subtle)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: "var(--color-primary)" }}>
                  {durationStats?.total_sessions ?? 0}
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>训练次数</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 0", background: "var(--bg-surface-subtle)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: "var(--color-clinical)" }}>
                  {durationStats?.total_minutes ?? 0}
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>累计分钟</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════
// 教师端仪表盘
// ═══════════════════════════════════════════

function TeacherDashboard({ user, onLogout, stats, records, handleExport, navigate }) {
  const recentRecords = records.slice(0, 5);

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title="教学仪表盘"
        subtitle="全局概览：学生训练情况、系统数据、快捷管理入口"
        icon={Target}
        actions={
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className="btn btn-primary" onClick={() => navigate("/admin")}>
              <Settings size={16} /> 管理后台
            </button>
            <button className="btn" onClick={handleExport}>
              <Download size={16} /> 导出CSV
            </button>
          </div>
        }
      />

      {/* 统计卡片 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <StatCard icon={Users} value={stats?.total_students ?? "-"} label="学生总数" color="blue" onClick={() => navigate("/admin")} />
        <StatCard icon={ClipboardList} value={stats?.total_records ?? "-"} label="总训练次数" color="teal" onClick={() => navigate("/history")} />
        <StatCard icon={CheckCircle} value={stats?.completed_records ?? "-"} label="已完成训练" color="green" />
        <StatCard icon={Star} value={stats?.average_score ?? "-"} label="平均得分" color="amber" onClick={() => navigate("/stats")} />
        <StatCard icon={Clock} value={stats?.avg_duration_min ?? "-"} label="平均时长(分钟)" color="blue" />
      </div>

      {/* 训练趋势图 */}
      <TrainingDurationChart />

      {/* 最近动态 + 快捷入口 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-5)" }}>
        <div className="card">
          <div className="card-header">
            <h3><ClipboardList size={17} />最近训练动态</h3>
            <span className="link" onClick={() => navigate("/history")}>查看全部 →</span>
          </div>
          {recentRecords.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>学生</th><th>病例</th><th>状态</th><th>时间</th><th>得分</th><th></th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user_display_name}</td>
                    <td>{r.case_name}</td>
                    <td>
                      <span className={`badge ${r.status === "completed" ? "badge-success" : "badge-info"}`}>
                        {r.status === "completed" ? "已完成" : "进行中"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {new Date(r.start_time).toLocaleString("zh-CN")}
                    </td>
                    <td>
                      {r.score_total != null ? (
                        <span style={{
                          fontWeight: 600,
                          color: r.score_total >= 85 ? "var(--color-success)"
                            : r.score_total >= 70 ? "var(--color-primary)"
                            : r.score_total >= 60 ? "var(--color-warning)"
                            : "var(--color-danger)",
                        }}>
                          {r.score_total}分
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className="link" onClick={() => navigate(`/record/${r.id}`)}>详情</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
              暂无训练记录
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="side-card">
            <div className="side-card-head">
              <h3>快捷入口</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => navigate("/admin?tab=records")}>
                <ClipboardList size={14} /> 训练记录管理
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => navigate("/admin?tab=users")}>
                <Users size={14} /> 学生账号管理
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => navigate("/admin?tab=cases")}>
                <BookOpen size={14} /> 病例库管理
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start", width: "100%" }} onClick={() => navigate("/admin?tab=monitor")}>
                <TrendingUp size={14} /> LLM 调用监控
              </button>
            </div>
          </div>

          <div className="side-card">
            <div className="side-card-head">
              <h3>数据概况</h3>
            </div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>学生总数</span>
                <strong>{stats?.total_students ?? "-"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>训练完成率</span>
                <strong>
                  {stats?.total_records > 0
                    ? `${Math.round((stats.completed_records / stats.total_records) * 100)}%`
                    : "-"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>今日训练次数</span>
                <strong>{stats?.today_records ?? "-"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
