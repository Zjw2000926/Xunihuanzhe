import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Send, Mic, MicOff, Phone, Volume2, VolumeX, Clock, ListChecks, ChevronRight, X, Circle, CheckCircle2 } from "lucide-react";
import { getRecordDetail, sendMessageStream, endTraining } from "../api";
import ScoreCard from "../components/ScoreCard";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";

function extractKeywords(inquiry) {
  const cleaned = inquiry.replace(/[（）\(\)]/g, " ");
  const tokens = [];
  for (let i = 0; i < cleaned.length - 1; i++) {
    tokens.push(cleaned.slice(i, i + 2));
  }
  return [...new Set(tokens.filter((t) => t.trim().length === 2))];
}

function getInquiryLabel(inquiry) {
  return inquiry.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").slice(0, 18);
}

function InquirySidebar({ inquiries, studentMessages, isOpen, onToggle }) {
  const addressed = useMemo(() => {
    if (!inquiries || inquiries.length === 0) return new Set();
    const allText = studentMessages.map((m) => m.content).join("");
    const result = new Set();
    inquiries.forEach((inquiry, idx) => {
      const keywords = extractKeywords(inquiry);
      const matched = keywords.some((kw) => allText.includes(kw));
      if (matched) result.add(idx);
    });
    return result;
  }, [inquiries, studentMessages]);

  const covered = addressed.size;
  const total = inquiries.length;
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  return (
    <>
      <button
        className="inquiry-toggle"
        onClick={onToggle}
        title="采集进度"
        style={{
          position: "relative",
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 20,
          border: "1px solid #d1d5db", background: "#fff",
          cursor: "pointer", fontSize: "0.78rem", fontWeight: 500, color: "#374151",
          transition: "all 0.15s",
        }}
      >
        <ListChecks size={16} />
        <span>{covered}/{total}</span>
        {pct < 100 && (
          <span style={{
            position: "absolute", top: -3, right: -3, width: 8, height: 8,
            borderRadius: "50%", background: "#f59e0b",
          }} />
        )}
      </button>

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 300, maxWidth: "85vw",
        background: "#fff", zIndex: 1000, boxShadow: "-2px 0 20px rgba(0,0,0,0.1)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
        }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <ListChecks size={18} /> 采集进度
          </h3>
          <button onClick={onToggle} style={{
            width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb",
            background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>关键问诊内容覆盖</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: pct >= 80 ? "#15803d" : pct >= 40 ? "#b45309" : "#dc2626" }}>
              {covered}/{total}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444",
              width: `${pct}%`, transition: "width 0.5s ease",
            }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
          {inquiries.map((inquiry, idx) => {
            const done = addressed.has(idx);
            return (
              <div key={idx} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "9px 20px", fontSize: "0.78rem", color: done ? "#374151" : "#9ca3af",
                transition: "color 0.2s",
              }}>
                {done
                  ? <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
                  : <Circle size={16} style={{ color: "#d1d5db", flexShrink: 0, marginTop: 1 }} />
                }
                <span style={{ lineHeight: 1.4 }}>{getInquiryLabel(inquiry)}</span>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: "12px 20px", borderTop: "1px solid #f3f4f6",
          fontSize: "0.7rem", color: "#9ca3af", lineHeight: 1.5,
        }}>
          提示：系统根据对话关键词自动匹配，仅供参考。建议按护理评估框架全面采集病史。
        </div>
      </div>

      {isOpen && (
        <div
          onClick={onToggle}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 999 }}
        />
      )}
    </>
  );
}

export default function ChatTraining() {
  const { recordId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [score, setScore] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState({ recognition: false, synthesis: false });
  const [requiredInquiries, setRequiredInquiries] = useState([]);
  const [showInquirySidebar, setShowInquirySidebar] = useState(false);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const autoEndRef = useRef(false);
  const warned5Ref = useRef(false);
  const warned2Ref = useRef(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const studentMessages = useMemo(() => messages.filter((m) => m.role === "student"), [messages]);

  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const isActive = () => remaining > 0 && !score && !ending;
    const handler = (e) => {
      if (isActive()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [remaining, score, ending]);

  useEffect(() => {
    getRecordDetail(recordId).then(({ data }) => {
      setMessages(data.messages || []);
      if (data.case_name) setCaseTitle(data.case_name);
      if (data.required_inquiries) setRequiredInquiries(data.required_inquiries);
      const limit = data.time_limit || 20;
      const startMs = new Date(data.start_time).getTime();
      const nowMs = Date.now();
      const elapsed = Math.floor((nowMs - startMs) / 1000);
      const r = Math.max(0, limit * 60 - elapsed);
      setRemaining(r);
      setTimerActive(true);
      if (data.messages?.length > 0) {
        const m = data.messages[0].content.match(/我是(.+?)[。，]/);
        if (m) setPatientName(m[1]);
      }
    }).catch(() => { toast.error("加载训练记录失败"); navigate("/cases"); });
  }, [recordId, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const rec = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const syn = !!window.speechSynthesis;
    setSpeechSupported({ recognition: rec, synthesis: syn });
  }, []);

  const speakText = useCallback((text) => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, [speaking]);

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info("您的浏览器不支持语音输入，请使用 Chrome 或 Edge");
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      setInput(e.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error === "not-allowed") {
        toast.warning("麦克风权限被拒绝，请在浏览器设置中允许");
      } else if (e.error === "no-speech") {
        toast.info("未检测到语音，请重试");
      } else {
        toast.info("语音识别失败，请重试");
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading) return;
    setInput("");
    const studentMsgId = Date.now();
    const patientMsgId = studentMsgId + 1;
    setMessages((prev) => [...prev,
      { role: "student", content, id: studentMsgId },
      { role: "patient", content: "", id: patientMsgId, streaming: true },
    ]);
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    await sendMessageStream(
      Number(recordId), content,
      (chunk) => {
        setMessages((prev) => prev.map((msg) =>
          msg.id === patientMsgId ? { ...msg, content: msg.content + chunk } : msg));
      },
      (doneId) => {
        setMessages((prev) => prev.map((msg) =>
          msg.id === patientMsgId ? { ...msg, streaming: false, id: doneId || msg.id } : msg));
        setLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      },
      (error) => {
        toast.error(error);
        setMessages((prev) => prev.filter((msg) => msg.id !== patientMsgId));
        setInput(content);
        setLoading(false);
        if (abortRef.current === controller) abortRef.current = null;
      },
      controller.signal,
    );
  };

  const executeEnd = async (isAuto = false) => {
    setEnding(true);
    clearInterval(timerRef.current);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await endTraining(Number(recordId), controller.signal);
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const detail = await getRecordDetail(recordId);
        if (detail.data.scoring_status === "completed" && detail.data.score) {
          setScore(detail.data.score);
          setShowScore(true);
          break;
        }
        if (detail.data.scoring_status === "failed") {
          toast.error("自动评分失败，可在训练记录中手动重试");
          break;
        }
      }
    } catch (err) {
      if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
        if (!isAuto) toast.error(err.response?.data?.detail || "结束训练失败，请重试");
      }
    } finally {
      setEnding(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleEnd = async () => {
    const ok = await confirm({ title: "结束训练", message: "确定结束本次训练吗？结束后将自动评分，可能需要等待数十秒。", confirmLabel: "确定结束", danger: true });
    if (!ok) return;
    executeEnd(false);
  };

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 300 && remaining > 299 && !warned5Ref.current) {
      warned5Ref.current = true;
      toast.warning("训练时间剩余 5 分钟");
    }
    if (remaining <= 120 && remaining > 119 && !warned2Ref.current) {
      warned2Ref.current = true;
      toast.warning("训练时间剩余 2 分钟，即将自动结束");
    }
    if (remaining === 0 && !autoEndRef.current) {
      toast.info("训练时间已结束，正在自动评分...");
    }
  }, [remaining]);

  useEffect(() => {
    if (remaining === 0 && !ending && !showScore) {
      if (autoEndRef.current) return;
      autoEndRef.current = true;
      executeEnd(true);
    }
  }, [remaining, ending, showScore]);

  const formatTime = (sec) => {
    if (sec == null) return "--:--";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="training-shell">
      <header className="training-topbar">
        <button className="training-back" onClick={async () => { const isActive = remaining > 0 && !score && !ending; if (isActive) { const ok = await confirm({ title: "离开训练", message: "训练还在进行中，离开将丢失当前进度，确认离开吗？", confirmLabel: "确认离开", danger: true }); if (!ok) return; } navigate("/home"); }} title="返回首页">
          <ArrowLeft size={20} />
        </button>
        <div className="training-patient-identity">
          <div className="training-patient-avatar">
            <User size={20} />
          </div>
          <div>
            <div className="training-patient-name">{patientName || "虚拟患者"}</div>
            <div className="training-patient-desc">
              {caseTitle} · {loading ? "正在输入..." : "在线"}
            </div>
          </div>
        </div>

        {requiredInquiries.length > 0 && (
          <InquirySidebar
            inquiries={requiredInquiries}
            studentMessages={studentMessages}
            isOpen={showInquirySidebar}
            onToggle={() => setShowInquirySidebar((v) => !v)}
          />
        )}

        <div
          className="training-timer"
          style={remaining !== null && remaining <= 120 ? { background: "#fef2f2", borderColor: "#fca5a5", color: "#dc2626" } : remaining !== null && remaining <= 300 ? { background: "#fffbeb", borderColor: "#fcd34d", color: "#d97706" } : {}}
        >
          <Clock size={16} />
          <span>{formatTime(remaining)}</span>
        </div>
        <button className="training-end-btn" onClick={handleEnd} disabled={ending || messages.length <= 1}>
          <Phone size={16} />
          <span>{ending ? "评分中..." : "结束训练"}</span>
        </button>
      </header>

      <div className="training-conversation">
        {messages.length <= 1 && (
          <div className="training-hint">
            <div className="training-hint-icon">
              <User size={36} strokeWidth={1} />
            </div>
            <p>请按照护理评估流程与患者交流</p>
            <span>从主诉开始，逐步了解现病史、既往史、用药史等信息</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`msg-row ${msg.role}`}>
            <div className={`msg-bubble${msg.streaming ? " streaming" : ""}`}>
              <p>{msg.content}{msg.streaming ? "" : ""}</p>
            </div>
            {msg.role === "patient" && !msg.streaming && speechSupported.synthesis && (
              <button className="msg-speak-btn" onClick={() => speakText(msg.content)} title={speaking ? "停止朗读" : "朗读"}>
                {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
          </div>
        ))}
        {loading && !messages.some(m => m.streaming) && (
          <div className="msg-row patient">
            <div className="msg-bubble">
              <div className="typing-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}
        {remaining === 0 && (
          <div className="time-up-banner">训练时间已结束，系统正在自动评分...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="training-input-bar">
        {speechSupported.recognition && (
        <button
          className={`voice-btn ${isListening ? "active" : ""}`}
          onClick={toggleVoice}
          disabled={loading || ending || remaining === 0}
          title={isListening ? "停止录音" : "语音输入"}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={remaining === 0 ? "训练时间已结束" : "输入你的问题，按 Enter 发送..."}
          disabled={loading || ending || remaining === 0}
        />
        <button className="send-btn" onClick={handleSend} disabled={!input.trim() || loading || ending || remaining === 0}>
          <Send size={18} />
        </button>
      </div>

      {showScore && score && <ScoreCard score={score} onClose={() => setShowScore(false)} />}
    </div>
  );
}
