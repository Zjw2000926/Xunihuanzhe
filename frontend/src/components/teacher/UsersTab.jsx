import { useState, useEffect, useCallback } from "react";
import { Edit3, Trash2, Plus, Upload, FileText, Download, AlertCircle, Users } from "lucide-react";
import { getUsers, register, updateUser, deleteUser, batchCreateUsers } from "../../api";
import { useToast } from "../Toast";
import { useConfirm } from "../ui/ConfirmDialog";
import Modal from "../ui/Modal";

export default function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ username: "", password: "", role: "student", display_name: "", student_id: "" });
  const [regMsg, setRegMsg] = useState("");
  const [showEditUser, setShowEditUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ display_name: "", student_id: "", role: "", password: "" });
  const [editUserMsg, setEditUserMsg] = useState("");
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchPreview, setBatchPreview] = useState([]);
  const [batchParseError, setBatchParseError] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [batchImporting, setBatchImporting] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const loadUsers = useCallback(() => {
    getUsers().then(({ data }) => setUsers(data)).catch(() => toast.error("加载用户列表失败"));
  }, [toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMsg("");
    try {
      const payload = { ...regForm };
      if (!payload.student_id) payload.student_id = null;
      await register(payload);
      setRegMsg("注册成功！");
      setRegForm({ username: "", password: "", role: "student", display_name: "", student_id: "" });
      loadUsers();
    } catch (err) {
      setRegMsg(err.response?.data?.detail || "注册失败");
    }
  };

  const openEditUser = (u) => {
    setEditUser(u);
    setEditUserForm({ display_name: u.display_name, student_id: u.student_id || "", role: u.role, password: "" });
    setEditUserMsg("");
    setShowEditUser(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setEditUserMsg("");
    const payload = {};
    if (editUserForm.display_name) payload.display_name = editUserForm.display_name;
    if (editUserForm.student_id) payload.student_id = editUserForm.student_id;
    else payload.student_id = null;
    if (editUserForm.role) payload.role = editUserForm.role;
    if (editUserForm.password) payload.password = editUserForm.password;
    try {
      await updateUser(editUser.id, payload);
      setShowEditUser(false);
      loadUsers();
    } catch (err) {
      setEditUserMsg(err.response?.data?.detail || "保存失败");
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === currentUserId) { toast.warning("不能删除自己的账号"); return; }
    const ok = await confirm({ title: "删除用户", message: `确定删除用户"${u.display_name}"(${u.username})吗？此操作不可恢复。`, confirmLabel: "确定删除", danger: true });
    if (!ok) return;
    try {
      await deleteUser(u.id);
      toast.success("用户已删除");
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "删除失败");
    }
  };

  function parseBatchText(text) {
    setBatchParseError("");
    setBatchPreview([]);
    if (!text.trim()) { setBatchPreview([]); return; }
    const lines = text.trim().split("\n").filter((l) => l.trim());
    const users = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",").map((s) => s.trim());
      if (parts.length < 4) { setBatchParseError(`第 ${i + 1} 行格式不正确，需要至少4列（用户名,密码,姓名,角色）`); setBatchPreview([]); return; }
      users.push({ username: parts[0], password: parts[1], display_name: parts[2], role: parts[3] || "student", student_id: parts[4] || null });
    }
    setBatchPreview(users);
  }

  function parseCSVFile(file) {
    setBatchParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target.result.replace(/^﻿/, "");
      const lines = text.trim().split("\n").filter((l) => l.trim());
      if (lines.length <= 1) { parseBatchText(text); return; }
      const firstIsHeader = !/^\d/.test(lines[0]);
      parseBatchText(firstIsHeader ? lines.slice(1).join("\n") : text);
    };
    reader.readAsText(file);
  }

  async function handleBatchImport() {
    if (batchPreview.length === 0) return;
    setBatchImporting(true);
    setBatchResult(null);
    try {
      const { data } = await batchCreateUsers(batchPreview);
      setBatchResult(data);
      if (data.created > 0) { toast.success(`成功创建 ${data.created} 名用户`); loadUsers(); }
      if (data.skipped > 0) toast.warning(`跳过 ${data.skipped} 名用户`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "批量导入失败");
    } finally { setBatchImporting(false); }
  }

  function handleDownloadTemplate() {
    const csvContent = "﻿用户名,密码,姓名,角色,学号\nstudent6,123456,赵六,student,2024006\nstudent7,123456,钱七,student,2024007";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "用户导入模板.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowRegister(!showRegister)}>
          {showRegister ? "取消" : <><Plus size={16} /> 注册新用户</>}
        </button>
        <button className="btn" onClick={() => { setShowBatchImport(true); setBatchText(""); setBatchPreview([]); setBatchParseError(""); setBatchResult(null); }}>
          <Users size={16} /> 批量导入
        </button>
      </div>

      {showRegister && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>添加用户</h3>
          {regMsg && <div className={regMsg.includes("成功") ? "success-msg" : "error-msg"}>{regMsg}</div>}
          <form onSubmit={handleRegister} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}><label>用户名</label><input value={regForm.username} onChange={(e) => setRegForm({ ...regForm, username: e.target.value })} required /></div>
            <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}><label>密码</label><input type="password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} required minLength="6" placeholder="至少6位" /></div>
            <div className="form-group" style={{ flex: "1 1 100px", marginBottom: 0 }}><label>角色</label><select value={regForm.role} onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}><option value="student">学生</option><option value="teacher">教师</option></select></div>
            <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}><label>姓名</label><input value={regForm.display_name} onChange={(e) => setRegForm({ ...regForm, display_name: e.target.value })} required /></div>
            <div className="form-group" style={{ flex: "1 1 100px", marginBottom: 0 }}><label>学号</label><input value={regForm.student_id} onChange={(e) => setRegForm({ ...regForm, student_id: e.target.value })} /></div>
            <button type="submit" className="btn btn-primary" style={{ height: 42 }}>注册</button>
          </form>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>学号</th><th>注册时间</th><th>操作</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.display_name}</td>
                <td><span className={`badge ${u.role === "teacher" ? "badge-info" : "badge-success"}`}>{u.role === "teacher" ? "教师" : "学生"}</span></td>
                <td style={{ color: "var(--text-secondary)" }}>{u.student_id || "-"}</td>
                <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{new Date(u.created_at).toLocaleString("zh-CN")}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-sm" onClick={() => openEditUser(u)} title="编辑"><Edit3 size={14} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u)} title="删除"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      <Modal open={showEditUser} onClose={() => setShowEditUser(false)} title={`编辑用户: ${editUser?.display_name}`} maxWidth={480}>
        {editUserMsg && <div className="error-msg" style={{ marginBottom: 16 }}>{editUserMsg}</div>}
        <form onSubmit={handleSaveUser}>
          <div className="form-group"><label>姓名</label><input value={editUserForm.display_name} onChange={(e) => setEditUserForm((f) => ({ ...f, display_name: e.target.value }))} required /></div>
          <div className="form-group"><label>学号</label><input value={editUserForm.student_id} onChange={(e) => setEditUserForm((f) => ({ ...f, student_id: e.target.value }))} /></div>
          <div className="form-group"><label>角色</label><select value={editUserForm.role} onChange={(e) => setEditUserForm((f) => ({ ...f, role: e.target.value }))}><option value="student">学生</option><option value="teacher">教师</option></select></div>
          <div className="form-group"><label>新密码（留空不修改）</label><input type="password" value={editUserForm.password} onChange={(e) => setEditUserForm((f) => ({ ...f, password: e.target.value }))} placeholder="至少6位" minLength="6" /></div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowEditUser(false)}>取消</button>
            <button type="submit" className="btn btn-primary">保存</button>
          </div>
        </form>
      </Modal>

      {/* Batch Import Modal */}
      <Modal open={showBatchImport} onClose={() => { if (!batchImporting) setShowBatchImport(false); }} title={<><Users size={20} /> 批量导入用户</>} maxWidth={650}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><FileText size={14} /> 粘贴文本（每行一个用户，逗号分隔）</label>
          <textarea rows={5} placeholder="用户名,密码,姓名,角色,学号\nstudent6,123456,赵六,student,2024006" value={batchText} onChange={(e) => { setBatchText(e.target.value); parseBatchText(e.target.value); }} style={{ width: "100%", fontFamily: "monospace", fontSize: "0.8rem" }} disabled={batchImporting} />
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>格式：用户名,密码,姓名,角色,学号</div>
        </div>
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="btn btn-sm" style={{ cursor: "pointer" }}><Upload size={14} /> 上传 CSV 文件<input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBatchText(""); parseCSVFile(f); } e.target.value = ""; }} style={{ display: "none" }} disabled={batchImporting} /></label>
          <span className="link" onClick={handleDownloadTemplate} style={{ fontSize: "0.8rem" }}><Download size={14} style={{ verticalAlign: -3, marginRight: 2 }} />下载模板</span>
        </div>
        {batchParseError && <div style={{ color: "var(--red-500)", fontSize: "0.82rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={16} /> {batchParseError}</div>}
        {batchPreview.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>预览（{batchPreview.length} 名用户）</div>
            <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
              <table className="data-table" style={{ margin: 0 }}><thead><tr><th>用户名</th><th>密码</th><th>姓名</th><th>角色</th><th>学号</th></tr></thead><tbody>{batchPreview.map((u, i) => (<tr key={i}><td>{u.username}</td><td>{"*".repeat(Math.min(u.password.length, 8))}</td><td>{u.display_name}</td><td><span className={`badge ${u.role === "teacher" ? "badge-info" : "badge-success"}`}>{u.role === "teacher" ? "教师" : "学生"}</span></td><td style={{ color: "var(--text-secondary)" }}>{u.student_id || "-"}</td></tr>))}</tbody></table>
            </div>
          </div>
        )}
        {batchResult && (
          <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, fontSize: "0.85rem", background: batchResult.created > 0 ? "#f0fdf4" : "#fffbeb", border: `1px solid ${batchResult.created > 0 ? "#86efac" : "#fde68a"}` }}>
            <div>创建成功: <strong style={{ color: "var(--green-500)" }}>{batchResult.created}</strong> 名</div>
            <div>跳过: <strong style={{ color: "var(--amber-500)" }}>{batchResult.skipped}</strong> 名</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => setShowBatchImport(false)} disabled={batchImporting}>取消</button>
          <button className="btn btn-primary" disabled={batchPreview.length === 0 || batchImporting} onClick={handleBatchImport}>{batchImporting ? "导入中..." : `导入 ${batchPreview.length} 名用户`}</button>
        </div>
      </Modal>
    </>
  );
}
