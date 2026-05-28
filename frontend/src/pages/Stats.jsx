import { useState, useEffect } from "react";
import {
  BarChart3, ClipboardList, Clock, TrendingUp, Star,
  Trophy, Medal, Activity, Target
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import { getTrends, getTeacherSummary, getStudentRanking } from "../api";
import { useToast } from "../components/Toast";

export default function Stats({ user, onLogout }) {
  const [period, setPeriod] = useState("month");
  const [trends, setTrends] = useState(null);
  const [summary, setSummary] = useState(null);
  const [ranking, setRanking] = useState(null);
  const toast = useToast();

  useEffect(() => {
    getTrends(period).then(({ data }) => setTrends(data)).catch(() => toast.error("加载趋势数据失败"));
    if (user?.role === "teacher") {
      getTeacherSummary().then(({ data }) => setSummary(data)).catch(() => toast.error("加载教师概览失败"));
      getStudentRanking().then(({ data }) => setRanking(data)).catch(() => toast.error("加载排行榜失败"));
    }
  }, [period, user]);

  const daily = trends?.daily || [];
  const hasData = daily.length > 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-date">{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontSize: "0.82rem" }}>
            {p.name}: <strong>{p.value}{p.name.includes("得分") ? "分" : p.name.includes("时长") ? "分钟" : "次"}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title="训练统计"
        subtitle={user?.role === "teacher" ? "查看所有学生的训练趋势、时长和得分统计" : "查看你的训练投入与效果趋势"}
        icon={BarChart3}
      />

      {/* Overview cards */}
      {trends && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><Activity size={22} /></div>
            <div>
              <div className="stat-value">{trends.total_sessions}</div>
              <div className="stat-label">总训练次数</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><Clock size={22} /></div>
            <div>
              <div className="stat-value">{trends.total_minutes}</div>
              <div className="stat-label">总训练时长（分钟）</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Target size={22} /></div>
            <div>
              <div className="stat-value">{trends.avg_score != null ? `${trends.avg_score}分` : "-"}</div>
              <div className="stat-label">平均得分</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan"><TrendingUp size={22} /></div>
            <div>
              <div className="stat-value">
                {trends.total_sessions > 0
                  ? `${Math.round(trends.total_minutes / trends.total_sessions)}分钟`
                  : "-"}
              </div>
              <div className="stat-label">平均每次训练时长</div>
            </div>
          </div>
        </div>
      )}

      {/* Period toggle (shared) */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div className="period-tabs">
          {["week", "month", "all"].map((p) => (
            <button
              key={p}
              className={`period-tab ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p === "week" ? "近7天" : p === "month" ? "近30天" : "全部"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart 1: Sessions + Duration */}
      <div className="chart-container">
        <h3 style={{ marginBottom: 16 }}>训练投入：次数与时长</h3>
        {hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: "次数", position: "insideLeft", offset: -5, style: { fontSize: 12 } }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: "分钟", position: "insideRight", offset: -5, style: { fontSize: 12 } }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="sessions" name="训练次数" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
              <Bar yAxisId="right" dataKey="minutes" name="训练时长" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>

      {/* Chart 2: Sessions + Score */}
      <div className="chart-container">
        <h3 style={{ marginBottom: 16 }}>训练效果：次数与得分</h3>
        {hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: "次数", position: "insideLeft", offset: -5, style: { fontSize: 12 } }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 60]} tick={{ fontSize: 12 }} label={{ value: "得分", position: "insideRight", offset: -5, style: { fontSize: 12 } }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="sessions" name="训练次数" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
              <Line yAxisId="right" type="monotone" dataKey="avg_score" name="平均得分" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: "#22c55e" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>

      {/* Teacher: Student summary */}
      {user?.role === "teacher" && summary && summary.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3><ClipboardList size={18} />学生训练统计</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>学生</th><th>学号</th><th>训练次数</th><th>总时长（分钟）</th><th>平均时长</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.student_id}>
                  <td>{s.display_name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{s.student_code}</td>
                  <td>{s.total_sessions}</td>
                  <td style={{ fontWeight: 600 }}>{s.total_minutes}</td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {s.total_sessions > 0 ? `${Math.round(s.total_minutes / s.total_sessions)}分钟` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Teacher: Ranking */}
      {user?.role === "teacher" && ranking && ranking.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3><Trophy size={18} style={{ color: "var(--amber-500)" }} />学生成绩排名</h3>
            <span style={{ fontSize: "0.78rem", color: "var(--gray-500)" }}>按平均分降序</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>排名</th>
                <th>学生</th><th>学号</th><th>训练次数</th><th>平均分</th><th>总分</th><th>总时长</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((s) => (
                <tr key={s.user_id} style={s.rank <= 3 ? { background: "var(--amber-50)" } : {}}>
                  <td>
                    {s.rank === 1 ? <Medal size={20} style={{ color: "#f59e0b" }} /> :
                     s.rank === 2 ? <Medal size={20} style={{ color: "#9ca3af" }} /> :
                     s.rank === 3 ? <Medal size={20} style={{ color: "#d97706" }} /> :
                     <span style={{ color: "var(--gray-500)", fontWeight: 600 }}>{s.rank}</span>}
                  </td>
                  <td style={{ fontWeight: 500 }}>{s.display_name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{s.student_id || "-"}</td>
                  <td>{s.total_sessions}</td>
                  <td style={{ fontWeight: 700, color: s.avg_score != null ? "var(--primary)" : "var(--text-light)" }}>
                    {s.avg_score != null ? `${s.avg_score}分` : "-"}
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{s.total_score > 0 ? `${s.total_score}分` : "-"}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{s.total_minutes}分钟</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

function EmptyChart() {
  return (
    <div className="empty-state" style={{ minHeight: 200 }}>
      <div className="icon"><BarChart3 size={42} /></div>
      <div>暂无该时间段的数据</div>
    </div>
  );
}
