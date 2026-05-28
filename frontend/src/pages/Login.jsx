import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { login } from "../api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await login(username, password);
      localStorage.setItem("token", data.access_token);
      onLogin({ role: data.role, display_name: data.display_name, user_id: data.user_id });
      navigate("/home");
    } catch (err) {
      setError(err.response?.data?.detail || "登录失败，请检查账号密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" style={{
          width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #2563eb, #7c3aed)",
          color: "#fff", boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
        }}>
          <Activity size={30} />
        </div>
        <h2>虚拟患者训练系统</h2>
        <p className="login-subtitle">护理病史采集技能训练平台</p>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, background: "var(--red-50)", color: "var(--red-600)",
            fontSize: "0.82rem", marginBottom: 16, border: "1px solid #fecaca", textAlign: "left",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            autoComplete="username"
            required
            autoFocus
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            autoComplete="current-password"
            required
          />
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "登录中..." : "登 录"}
          </button>
        </form>
      </div>
    </div>
  );
}
