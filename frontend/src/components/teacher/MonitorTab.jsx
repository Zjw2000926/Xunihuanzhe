import { useState, useEffect, useCallback } from "react";
import { Activity, TrendingUp, Server, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { getLLMStats, getLLMLogs } from "../../api";

const PURPOSE_LABELS = { patient_chat: "患者对话", scoring: "评分", qa: "问答", summary: "总结", other: "其他" };

function purposeLabel(item) {
  if (item.is_aggregated && item.purpose === "patient_chat") {
    return `训练对话（${item.call_count}轮）`;
  }
  return PURPOSE_LABELS[item.purpose] || item.purpose;
}

export default function MonitorTab() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ purpose: "", status: "", date_from: "", date_to: "" });
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(() => {
    getLLMStats().then(({ data }) => setStats(data)).catch(() => {});
    setLoading(true);
    const params = { page, page_size: 20 };
    if (filters.purpose) params.purpose = filters.purpose;
    if (filters.status) params.status = filters.status;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    getLLMLogs(params).then(({ data }) => { setLogs(data.items); setLogTotal(data.total); }).catch(() => {}).finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!stats) {
    return <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}><Activity size={36} style={{ marginBottom: 12 }} /><div>正在加载监控数据...</div></div>;
  }

  const statCards = [
    { label: "调用次数", value: stats.today.count, sub: `${stats.week.count} (7日)`, color: "blue" },
    { label: "成功率", value: `${stats.today.success_rate}%`, sub: `${stats.week.success_rate}% (7日)`, color: stats.today.success_rate >= 95 ? "green" : "amber" },
    { label: "平均延迟", value: `${stats.today.avg_latency_ms}ms`, sub: `${stats.week.avg_latency_ms}ms (7日)`, color: "blue" },
    { label: "预估费用", value: `¥${stats.today.total_cost.toFixed(4)}`, sub: `¥${stats.week.total_cost.toFixed(4)} (7日)`, color: "amber" },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>今日概览</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {statCards.map((s, i) => (
            <div key={i} className="card" style={{ textAlign: "center", padding: 20 }}>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 700, color: s.color === "green" ? "var(--color-success)" : s.color === "amber" ? "var(--color-warning)" : "var(--color-primary)" }}>{s.value}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {stats.daily.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 16, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={16} /> 近30天每日调用趋势</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120, paddingTop: 8 }}>
            {stats.daily.map((d) => {
              const maxCount = Math.max(...stats.daily.map((x) => x.count), 1);
              const h = Math.max(4, (d.count / maxCount) * 100);
              const failRatio = d.count > 0 ? d.fail_count / d.count : 0;
              return (
                <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }} title={`${d.date}: ${d.count}次`}>
                  <div style={{ fontSize: "0.55rem", color: "var(--text-tertiary)", marginBottom: 2 }}>{d.count || ""}</div>
                  <div style={{ width: "100%", height: `${h}%`, background: failRatio > 0.2 ? "var(--red-400)" : "var(--blue-400)", borderRadius: "2px 2px 0 0", opacity: 0.85, minHeight: 2 }} />
                  <div style={{ fontSize: "0.55rem", color: "var(--text-tertiary)", marginTop: 4, transform: "rotate(-45deg)", transformOrigin: "top left", whiteSpace: "nowrap" }}>{d.date.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}><Activity size={14} /> 按用途统计 (7日)</h3>
          <table className="data-table" style={{ margin: 0 }}><thead><tr><th>用途</th><th>次数</th><th>延迟</th><th>错误</th></tr></thead><tbody>{stats.by_purpose.map((p) => (<tr key={p.purpose}><td><span className="badge badge-info">{PURPOSE_LABELS[p.purpose] || p.purpose}</span></td><td style={{ fontWeight: 600 }}>{p.count}</td><td style={{ color: "var(--text-secondary)" }}>{p.avg_latency_ms}ms</td><td><span className={`badge ${p.error_count > 0 ? "badge-danger" : "badge-success"}`}>{p.error_count}</span></td></tr>))}</tbody></table>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}><Server size={14} /> 最近训练调用日志</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <select value={filters.purpose} onChange={(e) => { setFilters((f) => ({ ...f, purpose: e.target.value })); setPage(1); }} style={{ fontSize: "0.8rem", padding: "4px 8px" }}><option value="">全部用途</option>{Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }} style={{ fontSize: "0.8rem", padding: "4px 8px" }}><option value="">全部状态</option><option value="success">成功</option><option value="failed">失败</option><option value="timeout">超时</option></select>
          </div>
          {loading ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)" }}>加载中...</div> :
           logs.length === 0 ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-tertiary)" }}><Zap size={28} /><div style={{ fontSize: "0.85rem", marginTop: 8 }}>暂无日志记录</div></div> :
          <>
            <table className="data-table" style={{ margin: 0 }}><thead><tr><th>时间</th><th>用途</th><th>状态</th><th>延迟</th><th>Token</th><th>费用</th></tr></thead><tbody>{logs.map((item) => (<tr key={item.id}><td style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{new Date(item.created_at).toLocaleString("zh-CN")}</td><td><span className="badge badge-info">{purposeLabel(item)}</span></td><td><span className={`badge ${item.status === "success" ? "badge-success" : "badge-danger"}`}>{item.status}{item.error_count > 0 ? ` (${item.error_count}错)` : ""}</span></td><td style={{ color: "var(--text-secondary)" }}>{item.latency_ms != null ? `${item.latency_ms}ms${item.is_aggregated ? " 均" : ""}` : "-"}</td><td style={{ fontSize: "0.8rem" }}>{item.total_tokens != null ? `${item.total_tokens}${item.token_estimated ? "~" : ""}` : "-"}</td><td style={{ fontSize: "0.8rem", color: "var(--amber-500)" }}>{item.estimated_cost != null ? `¥${Number(item.estimated_cost).toFixed(4)}` : "-"}</td></tr>))}</tbody></table>
            {logTotal > 20 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 12 }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{page} / {Math.ceil(logTotal / 20)}</span>
                <button className="btn btn-sm" disabled={page >= Math.ceil(logTotal / 20)} onClick={() => setPage((p) => p + 1)}><ChevronRight size={14} /></button>
              </div>
            )}
          </>}
        </div>
      </div>
    </>
  );
}
