import { useState, useEffect, useCallback } from "react";
import { Plus, Edit3, Trash2, Upload, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { getManageCases, getCaseDetail, createCase, updateCase, deleteCase } from "../../api";
import { useToast } from "../Toast";
import { useConfirm } from "../ui/ConfirmDialog";
import Modal from "../ui/Modal";

const NEW_CASE_TEMPLATE = {
  name: "", time_limit: 20, description: "",
  patient_info: { name: "", age: 0, gender: "" },
  chief_complaint: "", opening_line: "",
  present_illness: "", past_history: "", medication_history: "", allergy_history: "",
  family_history: "", social_history: "", communication_style: "",
  hidden_info: [], required_inquiries: [],
  scoring_criteria: { "沟通技能": { max: 42, description: "", items: [] }, "病史采集": { max: 15, description: "", items: [] } },
};

function buildCaseData(form) {
  return {
    name: form.name, time_limit: form.time_limit, description: form.description,
    patient_info: { name: form.patient_name, age: form.patient_age, gender: form.patient_gender },
    chief_complaint: form.chief_complaint, opening_line: form.opening_line,
    present_illness: form.present_illness, past_history: form.past_history,
    medication_history: form.medication_history, allergy_history: form.allergy_history,
    family_history: form.family_history, social_history: form.social_history,
    communication_style: form.communication_style,
    hidden_info: form.hidden_info, required_inquiries: form.required_inquiries,
    scoring_criteria: form.scoring_criteria,
  };
}

function parseCaseData(cd) {
  const info = cd?.patient_info || {};
  return {
    name: cd?.name || "", time_limit: cd?.time_limit || 20, description: cd?.description || "",
    patient_name: info.name || "", patient_age: info.age || 0, patient_gender: info.gender || "",
    chief_complaint: cd?.chief_complaint || "", opening_line: cd?.opening_line || "",
    present_illness: cd?.present_illness || "", past_history: cd?.past_history || "",
    medication_history: cd?.medication_history || "", allergy_history: cd?.allergy_history || "",
    family_history: cd?.family_history || "", social_history: cd?.social_history || "",
    communication_style: cd?.communication_style || "",
    hidden_info: cd?.hidden_info || [], required_inquiries: cd?.required_inquiries || [],
    scoring_criteria: cd?.scoring_criteria || {},
  };
}

export default function CasesTab() {
  const [cases, setCases] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [caseForm, setCaseForm] = useState(parseCaseData(NEW_CASE_TEMPLATE));
  const [caseMsg, setCaseMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const loadCases = useCallback(() => {
    getManageCases().then(({ data }) => setCases(data)).catch(() => toast.error("加载病例列表失败"));
  }, [toast]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const openNew = () => {
    setEditingCase(null);
    setCaseForm(parseCaseData(NEW_CASE_TEMPLATE));
    setCaseMsg("");
    setShowAdvanced(false);
    setShowEditor(true);
  };

  const openEdit = (c) => {
    setEditingCase(c);
    getCaseDetail(c.id).then(({ data }) => setCaseForm(parseCaseData(data.case_data))).catch(() => toast.error("加载病例数据失败"));
    setCaseMsg("");
    setShowAdvanced(false);
    setShowEditor(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setCaseMsg("");
    const caseData = buildCaseData(caseForm);
    if (!caseData.name.trim()) { setCaseMsg("请输入病例名称"); return; }
    try {
      if (editingCase) { await updateCase(editingCase.id, caseData); }
      else { await createCase(caseData); }
      setShowEditor(false);
      loadCases();
    } catch (err) {
      setCaseMsg(err.response?.data?.detail || "保存失败");
    }
  };

  const handleDelete = async (c) => {
    if (c.training_count > 0) { toast.warning(`该病例已有 ${c.training_count} 条训练记录，无法删除`); return; }
    const ok = await confirm({ title: "删除病例", message: `确定删除病例"${c.name}"吗？`, confirmLabel: "确定删除", danger: true });
    if (!ok) return;
    try { await deleteCase(c.id); toast.success("病例已删除"); loadCases(); }
    catch (err) { toast.error(err.response?.data?.detail || "删除失败"); }
  };

  const handleJsonImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const json = JSON.parse(ev.target.result); setCaseForm(parseCaseData(json)); setCaseMsg("JSON 导入成功，请检查并保存"); }
      catch { setCaseMsg("JSON 格式解析失败"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateField = (field, value) => setCaseForm((prev) => ({ ...prev, [field]: value }));
  const updateList = (field, text) => setCaseForm((prev) => ({ ...prev, [field]: text.split("\n").filter((s) => s.trim()) }));

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> 添加病例</button>
      </div>

      <div className="card">
        {cases.length === 0 ? (
          <div className="empty-state"><div className="icon"><ClipboardList size={42} /></div><div>暂无病例，点击上方按钮添加</div></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>病例名称</th><th>患者</th><th>主诉</th><th>时限</th><th>训练次数</th><th>操作</th></tr></thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.patient_name ? `${c.patient_name}${c.patient_age ? ` · ${c.patient_age}岁` : ""}${c.patient_gender ? ` · ${c.patient_gender}` : ""}` : "-"}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.chief_complaint || "-"}</td>
                  <td><span className="badge badge-info">{c.time_limit || 20} 分钟</span></td>
                  <td style={{ color: c.training_count > 0 ? "var(--color-primary)" : "var(--text-tertiary)", fontWeight: 500 }}>{c.training_count}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(c)} title="编辑"><Edit3 size={14} /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)} disabled={c.training_count > 0} title={c.training_count > 0 ? "有训练记录，无法删除" : "删除"}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editingCase ? `编辑病例: ${editingCase.name}` : "添加新病例"} maxWidth={800}>
        {caseMsg && <div className={caseMsg.includes("成功") || caseMsg.includes("导入成功") ? "success-msg" : "error-msg"}>{caseMsg}</div>}
        <form onSubmit={handleSave} className="case-editor-form">
          <fieldset><legend>基础信息</legend>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}><label>病例名称 *</label><input value={caseForm.name} onChange={(e) => updateField("name", e.target.value)} required /></div>
              <div className="form-group" style={{ flex: 1 }}><label>训练时限 (分钟)</label><input type="number" min={5} max={120} value={caseForm.time_limit} onChange={(e) => updateField("time_limit", Number(e.target.value))} /></div>
            </div>
            <div className="form-group"><label>病例描述</label><input value={caseForm.description} onChange={(e) => updateField("description", e.target.value)} placeholder="一句话描述此病例的训练目标" /></div>
          </fieldset>
          <fieldset><legend>患者信息</legend>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}><label>姓名</label><input value={caseForm.patient_name} onChange={(e) => updateField("patient_name", e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>年龄</label><input type="number" min={0} max={120} value={caseForm.patient_age} onChange={(e) => updateField("patient_age", Number(e.target.value))} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>性别</label><select value={caseForm.patient_gender} onChange={(e) => updateField("patient_gender", e.target.value)}><option value="">--</option><option value="男">男</option><option value="女">女</option></select></div>
            </div>
          </fieldset>
          <fieldset><legend>临床信息</legend>
            <div className="form-group"><label>主诉</label><input value={caseForm.chief_complaint} onChange={(e) => updateField("chief_complaint", e.target.value)} /></div>
            <div className="form-group"><label>开场白</label><textarea rows={2} value={caseForm.opening_line} onChange={(e) => updateField("opening_line", e.target.value)} /></div>
            <div className="form-group"><label>现病史</label><textarea rows={3} value={caseForm.present_illness} onChange={(e) => updateField("present_illness", e.target.value)} /></div>
            <div className="form-group"><label>既往史</label><textarea rows={2} value={caseForm.past_history} onChange={(e) => updateField("past_history", e.target.value)} /></div>
            <div className="form-group"><label>用药史</label><textarea rows={2} value={caseForm.medication_history} onChange={(e) => updateField("medication_history", e.target.value)} /></div>
            <div className="form-group"><label>过敏史</label><input value={caseForm.allergy_history} onChange={(e) => updateField("allergy_history", e.target.value)} /></div>
            <div className="form-group"><label>家族史</label><textarea rows={2} value={caseForm.family_history} onChange={(e) => updateField("family_history", e.target.value)} /></div>
            <div className="form-group"><label>社会史 / 生活习惯</label><textarea rows={2} value={caseForm.social_history} onChange={(e) => updateField("social_history", e.target.value)} /></div>
            <div className="form-group"><label>沟通风格描述</label><textarea rows={2} value={caseForm.communication_style} onChange={(e) => updateField("communication_style", e.target.value)} /></div>
          </fieldset>
          <fieldset>
            <legend>
              <button type="button" className="btn btn-sm" onClick={() => setShowAdvanced(!showAdvanced)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 高级字段
              </button>
            </legend>
            {showAdvanced && (
              <>
                <div className="form-group"><label>隐藏信息（一行一条）</label><textarea rows={4} value={(caseForm.hidden_info || []).join("\n")} onChange={(e) => updateList("hidden_info", e.target.value)} /></div>
                <div className="form-group"><label>必须问到的内容（一行一条）</label><textarea rows={4} value={(caseForm.required_inquiries || []).join("\n")} onChange={(e) => updateList("required_inquiries", e.target.value)} /></div>
                <div className="form-group"><label>评分标准 (JSON)</label><textarea rows={6} style={{ fontFamily: "monospace", fontSize: "0.8rem" }} value={JSON.stringify(caseForm.scoring_criteria, null, 2)} onChange={(e) => { try { updateField("scoring_criteria", JSON.parse(e.target.value)); } catch { /* editing in progress */ } }} /></div>
              </>
            )}
          </fieldset>
          <div className="form-group"><label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", width: "fit-content" }}><Upload size={14} /> 从 JSON 文件导入<input type="file" accept=".json" onChange={handleJsonImport} style={{ display: "none" }} /></label></div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setShowEditor(false)}>取消</button>
            <button type="submit" className="btn btn-primary">{editingCase ? "保存修改" : "创建病例"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
