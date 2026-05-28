import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList, Lightbulb, Star, User } from "lucide-react";
import { getCases, startTraining } from "../api";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/Toast";

export default function CaseSelect({ user, onLogout }) {
  const [cases, setCases] = useState([]);
  const [difficultyFilter, setDifficultyFilter] = useState(0);
  const [startingId, setStartingId] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    getCases().then(({ data }) => setCases(data)).catch(() => toast.error("加载病例列表失败"));
  }, []);

  const filteredCases = difficultyFilter === 0
    ? cases
    : cases.filter((c) => (c.difficulty || 1) === difficultyFilter);

  const DIFFICULTY_LABELS = { 1: "初级", 2: "中级", 3: "高级" };

  const handleStart = async (caseId) => {
    setStartingId(caseId);
    try {
      const { data } = await startTraining(caseId);
      navigate(`/training/${data.record_id}`);
    } catch {
      toast.error("开始训练失败，请重试");
    } finally {
      setStartingId(null);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title="病例库"
        subtitle="选择一位虚拟患者开始病史采集训练。系统将模拟真实患者与你对话，训练结束后自动评分。"
        icon={ClipboardList}
        backTo="/home"
      />

      {/* 护理病史采集训练指导 */}
      <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, #fef3c7, #fffbeb)", border: "1px solid #fde68a" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Lightbulb size={24} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <h3 style={{ marginBottom: 8 }}>护理病史采集训练指导</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 8 }}>
              本训练旨在帮助护理学生掌握<strong>系统化的护理病史采集技能</strong>。请按照护理评估框架进行问诊：
            </p>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 8 }}>
              <strong>① 主诉与现病史评估</strong> — 了解患者就诊的主要原因，症状的发生、发展和演变过程<br />
              <strong>② 既往史与用药史</strong> — 了解慢性病史、用药情况、依从性和药物不良反应<br />
              <strong>③ 个人史与家族史</strong> — 评估生活方式、环境暴露、家族疾病风险<br />
              <strong>④ 功能与心理社会评估</strong> — 评估日常生活能力、情绪状态、家庭支持、健康认知
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--primary)", borderTop: "1px solid #fde68a", paddingTop: 8 }}>
              <AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              请勿直接询问"你得了什么病"，而是通过开放式提问引导患者描述。训练结束后系统将自动评分。
            </p>
          </div>
        </div>
      </div>

      {/* Difficulty filter */}
      <div className="difficulty-filter">
        {[0, 1, 2, 3].map((d) => (
          <button
            key={d}
            className={`difficulty-chip ${difficultyFilter === d ? "active" : ""}`}
            onClick={() => setDifficultyFilter(d)}
          >
            {d === 0 ? "全部" : DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>

      <div className="case-grid">
        {filteredCases.map((c) => {
          const p = c.patient_summary || {};
          const d = c.difficulty || 1;
          return (
            <div key={c.id} className="case-card">
              <div className="case-badge">
                <User size={14} /> {p.gender}性 · {p.age}岁
                <span className={`difficulty-badge d-${d}`}>
                  {Array.from({ length: d }, (_, i) => (
                    <Star key={i} size={10} fill="currentColor" />
                  ))}
                  {" "}{DIFFICULTY_LABELS[d]}
                </span>
              </div>
              <h3>{c.name}</h3>
              {p.chief_complaint && (
                <div style={{
                  background: "#f8fafc",
                  borderRadius: 8,
                  padding: "10px 14px",
                  margin: "12px 0",
                  borderLeft: "3px solid var(--primary)",
                }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-light)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    主诉
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text)", fontWeight: 500 }}>
                    {p.chief_complaint}
                  </div>
                </div>
              )}
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {c.description}
              </p>
              <div style={{ marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  onClick={() => handleStart(c.id)}
                  disabled={startingId === c.id}
                >
                  {startingId === c.id ? "加载中..." : "开始训练 →"}
                </button>
              </div>
            </div>
          );
        })}
        {filteredCases.length === 0 && (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            <div className="icon"><ClipboardList size={42} /></div>
            <div>暂无可用的病例</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
