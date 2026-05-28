import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, ClipboardList } from "lucide-react";
import { getRecords, exportRecords, deleteRecord, getManageCases } from "../../api";
import { useToast } from "../Toast";
import { useConfirm } from "../ui/ConfirmDialog";

export default function RecordsTab() {
  const [records, setRecords] = useState([]);
  const [caseOptions, setCaseOptions] = useState([]);
  const [filters, setFilters] = useState({ student_name: "", case_id: "", status: "", date_from: "", date_to: "" });
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const loadData = useCallback(() => {
    const params = {};
    if (filters.student_name) params.student_name = filters.student_name;
    if (filters.case_id) params.case_id = filters.case_id;
    if (filters.status) params.status = filters.status;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    getRecords(params).then(({ data }) => setRecords(data)).catch(() => toast.error("加载训练记录失败"));
  }, [filters, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getManageCases().then(({ data }) => setCaseOptions(data.map((c) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

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

  const handleDelete = async (r) => {
    const ok = await confirm({ title: "删除记录", message: `确定删除"${r.user_display_name}"对"${r.case_name}"的训练记录吗？此操作不可恢复。`, confirmLabel: "确定删除", danger: true });
    if (!ok) return;
    try {
      await deleteRecord(r.id);
      toast.success("训练记录已删除");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "删除失败");
    }
  };

  const clearFilters = () => setFilters({ student_name: "", case_id: "", status: "", date_from: "", date_to: "" });

  return (
    <div className="card">
      <div className="filter-bar">
        <div className="filter-row">
          <div className="filter-item">
            <label>学生姓名</label>
            <input placeholder="模糊搜索..." value={filters.student_name} onChange={(e) => setFilters((f) => ({ ...f, student_name: e.target.value }))} />
          </div>
          <div className="filter-item">
            <label>病例</label>
            <select value={filters.case_id} onChange={(e) => setFilters((f) => ({ ...f, case_id: e.target.value }))}>
              <option value="">全部</option>
              {caseOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>状态</label>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">全部</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <div className="filter-item">
            <label>开始日期(起)</label>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div className="filter-item">
            <label>开始日期(止)</label>
            <input type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
          </div>
          <div className="filter-item" style={{ alignSelf: "flex-end" }}>
            <button className="btn btn-sm" onClick={clearFilters}>清除过滤</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>共 {records.length} 条记录</span>
        <button className="btn btn-primary" onClick={handleExport}><Download size={16} />导出CSV</button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state"><div className="icon"><ClipboardList size={42} /></div><div>暂无训练记录</div></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>学生</th><th>学号</th><th>病例</th><th>状态</th><th>开始时间</th><th>时长</th><th>得分</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const durMins = r.end_time ? Math.round((new Date(r.end_time) - new Date(r.start_time)) / 60000) : null;
              return (
                <tr key={r.id}>
                  <td>{r.user_display_name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{r.user_student_id}</td>
                  <td>{r.case_name}</td>
                  <td><span className={`badge ${r.status === "completed" ? "badge-success" : "badge-info"}`}>{r.status === "completed" ? "已完成" : "进行中"}</span></td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{new Date(r.start_time).toLocaleString("zh-CN")}</td>
                  <td style={{ color: durMins != null ? "var(--text-secondary)" : "var(--text-tertiary)" }}>{durMins != null ? `${durMins} 分钟` : "进行中"}</td>
                  <td>
                    {r.score_total != null ? (
                      <span style={{
                        fontWeight: 600,
                        color: r.score_total >= 85 ? "var(--color-success)" : r.score_total >= 70 ? "var(--color-primary)" : r.score_total >= 60 ? "var(--color-warning)" : "var(--color-danger)",
                      }}>{r.score_total}分</span>
                    ) : <span style={{ color: "var(--text-tertiary)" }}>-</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="link" onClick={() => navigate(`/record/${r.id}`)}>查看</span>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)} title="删除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
