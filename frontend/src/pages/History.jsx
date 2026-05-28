import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { getRecords, deleteRecord } from "../api";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";

export default function History({ user, onLogout }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const fetchRecords = () => {
    setLoading(true);
    setError(null);
    getRecords()
      .then(({ data }) => setRecords(data))
      .catch((err) => setError(err.response?.data?.detail || "加载记录失败"))
      .finally(() => setLoading(false));
  };

  const handleDeleteRecord = async (r) => {
    const ok = await confirm({ title: "删除记录", message: `确定删除「${r.case_name}」的训练记录吗？此操作不可撤销。`, confirmLabel: "确定删除", danger: true });
    if (!ok) return;
    try {
      await deleteRecord(r.id);
      toast.success("训练记录已删除");
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.detail || "删除失败");
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title="训练记录"
        subtitle={user?.role === "teacher" ? "查看所有学生的训练记录" : "查看你的历史训练记录和评分结果"}
        icon={ClipboardList}
      />

      <div className="card">
        {loading ? (
          <div className="empty-state">
            <Loader2 size={42} className="spin" />
            <div>加载中...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="icon"><ClipboardList size={42} /></div>
            <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>
            <button className="btn btn-primary" onClick={fetchRecords}>
              <RefreshCw size={16} /> 重试
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><ClipboardList size={42} /></div>
            <div>暂无训练记录</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {user?.role === "teacher" && <th>学生</th>}
                {user?.role === "teacher" && <th>学号</th>}
                <th>病例</th>
                <th>开始时间</th>
                <th>时长</th>
                <th>状态</th>
                <th>得分</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const durMins = r.end_time
                  ? Math.round((new Date(r.end_time) - new Date(r.start_time)) / 60000)
                  : null;
                return (
                <tr key={r.id}>
                  {user?.role === "teacher" && <td>{r.user_display_name}</td>}
                  {user?.role === "teacher" && <td style={{ color: "var(--text-secondary)" }}>{r.user_student_id}</td>}
                  <td>{r.case_name}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {new Date(r.start_time).toLocaleString("zh-CN")}
                  </td>
                  <td style={{ color: durMins != null ? "var(--text-secondary)" : "var(--text-light)" }}>
                    {durMins != null ? `${durMins} 分钟` : "进行中"}
                  </td>
                  <td>
                    <span className={`badge ${r.status === "completed" ? "badge-success" : "badge-info"}`}>
                      {r.status === "completed" ? "已完成" : "进行中"}
                    </span>
                  </td>
                  <td>
                    {r.score_total != null ? (
                      <span style={{ fontWeight: 600, color: "var(--primary)" }}>{r.score_total}分</span>
                    ) : r.scoring_status === "pending" || r.scoring_status === "processing" ? (
                      <span style={{ fontSize: "0.78rem", color: "var(--amber-500)" }}>评分中...</span>
                    ) : r.scoring_status === "failed" ? (
                      <span style={{ fontSize: "0.78rem", color: "var(--red-500)" }} title={r.scoring_error}>评分失败</span>
                    ) : (
                      <span style={{ color: "var(--text-light)" }}>-</span>
                    )}
                  </td>
                  <td>
                    <span className="link" onClick={() => navigate(`/record/${r.id}`)}>查看详情</span>
                    {r.status === "in_progress" && user?.role !== "teacher" && (
                      <span className="link" style={{ marginLeft: 12 }} onClick={() => navigate(`/training/${r.id}`)}>
                        继续训练
                      </span>
                    )}
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ marginLeft: 12 }}
                      onClick={() => handleDeleteRecord(r)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
