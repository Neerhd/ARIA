const BASE = "/api";

export async function sendMessage(
  message,
  conversationId = null,
  fileContent = null,
  fileName = null,
  routingMode = null,
  overrideTier = null,
  toolsEnabled = [],
  projectId = null,
) {
  const body = { message, conversation_id: conversationId };
  if (fileContent) { body.file_content = fileContent; body.file_name = fileName; }
  if (routingMode) body.routing_mode = routingMode;
  if (overrideTier != null) body.override_tier = overrideTier;
  if (toolsEnabled && toolsEnabled.length > 0) body.tools_enabled = toolsEnabled;
  if (projectId) body.project_id = projectId;
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

export async function fetchConversations(projectId = null) {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const res = await fetch(`${BASE}/chat/conversations${qs}`);
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

export async function fetchMemoryEpisodes(projectId, limit = 20) {
  const res = await fetch(`${BASE}/memory/episodes?project_id=${encodeURIComponent(projectId)}&limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMemoryConcepts(projectId, limit = 40) {
  const res = await fetch(`${BASE}/memory/concepts?project_id=${encodeURIComponent(projectId)}&limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMemoryStats(projectId) {
  const res = await fetch(`${BASE}/memory/stats?project_id=${encodeURIComponent(projectId)}`);
  if (!res.ok) return {};
  return res.json();
}

export async function fetchReflections(projectId, limit = 20) {
  const res = await fetch(`${BASE}/consolidation/reflections?project_id=${encodeURIComponent(projectId)}&limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPinnedFacts() {
  const res = await fetch(`${BASE}/memory/pinned`);
  if (!res.ok) return [];
  return res.json();
}

export async function deletePinnedFact(factId) {
  const res = await fetch(`${BASE}/memory/pinned/${factId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

export async function fetchConsolidationRuns(limit = 5) {
  const res = await fetch(`${BASE}/consolidation/runs?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchRouterConfig() {
  const res = await fetch(`${BASE}/router/config`);
  if (!res.ok) return null;
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

export async function fetchProjects() {
  const res = await fetch(`${BASE}/projects`);
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function createProject(name, description = null) {
  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

export async function updateProject(projectId, { name, description } = {}) {
  const body = {};
  if (name != null) body.name = name;
  if (description != null) body.description = description;
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

export async function deleteProject(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}
