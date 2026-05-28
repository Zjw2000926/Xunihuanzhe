import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lightbulb, MessageCircle } from "lucide-react";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import { askQuestion } from "../api";

export default function QA({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const handledQueryRef = useRef(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendQuestion = useCallback(async (question) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const { data } = await askQuestion(q);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，AI导师暂时无法回复，请稍后重试。" }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (!q || handledQueryRef.current) return;
    handledQueryRef.current = true;
    setInput(q);
    sendQuestion(q);
  }, [searchParams, sendQuestion]);

  const handleSend = () => {
    sendQuestion(input);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <PageHeader
        title="护理问答"
        subtitle="向AI护理导师提问护理专业知识，获取即时解答"
        icon={MessageCircle}
      />

      <div className="qa-container">
        <div className="card" style={{ marginBottom: 16 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)" }}>
              <div className="empty-icon-soft"><Lightbulb size={42} /></div>
              <div style={{ marginBottom: 16, fontWeight: 500 }}>护理专业问答助手</div>
              <div style={{ fontSize: "0.85rem" }}>
                你可以询问以下内容：<br />
                病史采集技巧 · 护理评估方法 · 护理诊断知识<br />
                护理操作规范 · 疾病护理要点 · 沟通技巧指导
              </div>
            </div>
          ) : (
            <div className="qa-messages">
              {messages.map((m, i) => (
                <div key={i} className={`qa-bubble ${m.role === "user" ? "question" : "answer"}`}>
                  <div style={{ fontWeight: 600, fontSize: "0.75rem", marginBottom: 4, opacity: 0.7 }}>
                    {m.role === "user" ? "你" : "AI护理导师"}
                  </div>
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          <div className="qa-input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="输入你的护理专业问题..."
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || loading}>
              {loading ? "思考中" : "提问"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
