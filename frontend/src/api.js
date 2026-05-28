import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // 401 直接跳转登录，不重试
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      return Promise.reject(err);
    }

    // 网络错误或 5xx 自动重试一次
    const config = err.config;
    if (!config || config._retryCount >= 1) {
      return Promise.reject(err);
    }

    const shouldRetry =
      !err.response ||
      err.response.status >= 500 ||
      err.code === "ECONNABORTED" ||
      err.code === "ERR_NETWORK";

    if (!shouldRetry) {
      return Promise.reject(err);
    }

    config._retryCount = (config._retryCount || 0) + 1;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return api(config);
  }
);

export function login(username, password) {
  return api.post("/auth/login", { username, password });
}

export function register(data) {
  return api.post("/auth/register", data);
}

export function getMe() {
  return api.get("/auth/me");
}

export function getCases() {
  return api.get("/cases");
}

export function getCaseDetail(id) {
  return api.get(`/cases/${id}`);
}

export function startTraining(caseId) {
  return api.post("/training/start", { case_id: caseId });
}

export function sendMessage(recordId, content, signal) {
  return api.post(`/chat/${recordId}/message`, { content }, { signal });
}

export async function sendMessageStream(recordId, content, onChunk, onDone, onError, signal) {
  const token = localStorage.getItem("token");
  const resp = await fetch(`/api/chat/${recordId}/message/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "请求失败" }));
    onError(err.detail || "请求失败");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) {
          onError(data.error);
          return;
        }
        if (data.done) {
          onDone(data.id);
          return;
        }
        if (data.content) {
          onChunk(data.content);
        }
      } catch {}
    }
  }
}

export function endTraining(recordId, signal) {
  return api.post(`/training/${recordId}/end`, null, { signal });
}

export function retryScoring(recordId) {
  return api.post(`/training/${recordId}/retry-scoring`);
}

export function getRecords(params = {}) {
  return api.get("/training/records", { params });
}

export function deleteRecord(id) {
  return api.delete(`/training/records/${id}`);
}

export function getRecordDetail(id) {
  return api.get(`/training/records/${id}`);
}

export function exportRecords() {
  return api.get("/export/records", { responseType: "blob" });
}

export function exportRecordDetail(id) {
  return api.get(`/export/record/${id}`, { responseType: "blob" });
}

export function getUsers() {
  return api.get("/admin/users");
}

export function getStats() {
  return api.get("/admin/stats");
}

// Q&A
export function askQuestion(question) {
  return api.post("/qa/ask", { question });
}

// Duration stats
export function getDurationStats(period = "month") {
  return api.get(`/stats/duration?period=${period}`);
}

export function getTrends(period = "month") {
  return api.get(`/stats/trends?period=${period}`);
}

export function getTeacherSummary() {
  return api.get("/stats/teacher-summary");
}

export function getStudentRanking() {
  return api.get("/stats/ranking");
}

// 用户管理
export function updateUser(id, data) {
  return api.put(`/admin/users/${id}`, data);
}

export function batchCreateUsers(users) {
  return api.post("/admin/users/batch", users);
}

export function deleteUser(id) {
  return api.delete(`/admin/users/${id}`);
}

// 病例管理
export function getManageCases() {
  return api.get("/cases/manage/list");
}

export function createCase(caseData) {
  return api.post("/cases", { case_data: caseData });
}

export function updateCase(id, caseData) {
  return api.put(`/cases/${id}`, { case_data: caseData });
}

export function deleteCase(id) {
  return api.delete(`/cases/${id}`);
}

// LLM 调用监控
export function getLLMStats() {
  return api.get("/admin/llm-stats");
}

export function getLLMLogs(params = {}) {
  return api.get("/admin/llm-logs", { params: { aggregate_patient_chat: true, ...params } });
}

// 教师复核
export function getScoreReview(recordId) {
  return api.get(`/training/records/${recordId}/review`);
}

export function submitScoreReview(recordId, data) {
  return api.post(`/training/records/${recordId}/review`, data);
}
