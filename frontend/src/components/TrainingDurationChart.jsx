import { useEffect, useMemo, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getTrends } from "../api";

const PERIODS = [
  { key: "week", label: "近7天" },
  { key: "month", label: "近30天" },
  { key: "all", label: "全部" },
];

export default function TrainingDurationChart() {
  const [period, setPeriod] = useState("month");
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    getTrends(period)
      .then(({ data }) => {
        if (!cancelled) setTrends(data);
      })
      .catch(() => {
        if (!cancelled) setTrends(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [period]);

  const chartData = useMemo(() => {
    const daily = trends?.daily || [];
    return daily.map((item) => ({
      name: item.date?.slice(5) || item.date,
      sessions: item.sessions,
      minutes: item.minutes,
      avg_score: item.avg_score,
    }));
  }, [trends]);

  const averageMinutes = trends?.total_sessions
    ? Math.round(trends.total_minutes / trends.total_sessions)
    : 0;

  return (
    <div className="chart-card">
      <div className="chart-card-top">
        <div>
          <h3>训练投入趋势</h3>
          <span className="chart-card-sub">每日训练次数与时长关联</span>
        </div>
        <div className="period-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`period-tab ${period === p.key ? "active" : ""}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-summary-row">
        <div className="chart-summary-item">
          <span className="chart-summary-val">{trends?.total_sessions ?? 0}次</span>
          <span className="chart-summary-lbl">训练次数</span>
        </div>
        <div className="chart-summary-item">
          <span className="chart-summary-val">{trends?.total_minutes ?? 0}min</span>
          <span className="chart-summary-lbl">总时长</span>
        </div>
        <div className="chart-summary-item">
          <span className="chart-summary-val">{averageMinutes}min</span>
          <span className="chart-summary-lbl">平均时长</span>
        </div>
        <div className="chart-summary-item">
          <span className="chart-summary-val">{trends?.avg_score != null ? `${trends.avg_score}分` : "-"}</span>
          <span className="chart-summary-lbl">平均得分</span>
        </div>
      </div>

      {loading ? (
        <div className="chart-empty">正在加载训练统计...</div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} unit="min" />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "0.8rem" }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="sessions" name="训练次数" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar yAxisId="right" dataKey="minutes" name="训练时长" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="chart-empty">暂无训练统计数据</div>
      )}
    </div>
  );
}
