const BASE = "/api";

export async function sendMessage(message, conversationId = null, fileContent = null, fileName = null) {
  const body = { message, conversation_id: conversationId };
  if (fileContent) {
    body.file_content = fileContent;
    body.file_name = fileName;
  }
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/files/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed ${res.status}`);
  }
  return res.json(); // { filename, char_count, truncated, text }
}

export async function fetchConversations() {
  const res = await fetch(`${BASE}/chat/conversations`);
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export async function fetchMessages(conversationId) {
  const res = await fetch(`${BASE}/chat/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchMemoryEpisodes(limit = 20) {
  const res = await fetch(`${BASE}/memory/episodes?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMemoryConcepts(limit = 40) {
  const res = await fetch(`${BASE}/memory/concepts?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMemoryStats() {
  const res = await fetch(`${BASE}/memory/stats`);
  if (!res.ok) return {};
  return res.json();
}

export async function fetchReflections(limit = 20) {
  const res = await fetch(`${BASE}/consolidation/reflections?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchConsolidationRuns(limit = 5) {
  const res = await fetch(`${BASE}/consolidation/runs?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function triggerConsolidation() {
  const res = await fetch(`${BASE}/consolidation/run`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}
