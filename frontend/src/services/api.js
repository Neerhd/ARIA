const BASE = "/api";

// ─── Request helpers ──────────────────────────────────────────────────────────
// Two error styles exist across the app, both preserved:
// - request(): throws Error(detail from the backend, or a status fallback) —
//   for actions where the UI surfaces the failure.
// - requestOr(): returns a fallback value on any failure — for best-effort
//   reads where the UI just renders an empty state.

async function request(path, { method = "GET", body, errorMessage } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!res.ok) {
    if (errorMessage) throw new Error(errorMessage);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

async function requestOr(path, fallback) {
  try {
    return await request(path);
  } catch {
    return fallback;
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

// The backend streams the reply as NDJSON — one JSON object per line:
//   {"type": "meta", conversation_id, message_id, model, provider, role, sources}
//   {"type": "text_delta", text}          — append to the growing reply
//   {"type": "round_reset"}                — a tool call was made; the text
//                                             streamed so far this round was
//                                             preamble chatter, never part of
//                                             the real reply — discard it
//   {"type": "done", tools_used}
//   {"type": "error", detail}              — surfaced as a thrown Error, same
//                                             as any other failed request
// onEvent is called once per parsed line, in arrival order.
export async function sendMessage(
  message,
  conversationId = null,
  fileContent = null,
  fileName = null,
  routingMode = null,
  overrideProvider = null,
  overrideModel = null,
  projectId = null,
  image = null, // { data, mime } — base64, from an uploadFile() is_image response
  onEvent = () => {},
  signal = null, // AbortSignal — abort() rejects with a DOMException named "AbortError"
) {
  const body = { message, conversation_id: conversationId };
  if (fileContent) { body.file_content = fileContent; body.file_name = fileName; }
  if (image) {
    body.image_data = image.data;
    body.image_mime = image.mime;
    if (fileName) body.file_name = fileName;
  }
  if (routingMode) body.routing_mode = routingMode;
  if (overrideProvider && overrideModel) {
    body.override_provider = overrideProvider;
    body.override_model = overrideModel;
  }
  if (projectId) body.project_id = projectId;

  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(event.detail || "The model call failed.");
        onEvent(event);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/files/upload`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed ${res.status}`);
  }
  return res.json(); // { filename, char_count, truncated, text }
}

export async function fetchConversations(projectId = null) {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return request(`/chat/conversations${qs}`, { errorMessage: "Failed to load conversations" });
}

export async function setConversationPinned(conversationId, pinned) {
  return request(`/chat/conversations/${conversationId}`, {
    method: "PATCH",
    body: { pinned },
  });
}

export async function fetchMessages(conversationId) {
  return request(`/chat/conversations/${conversationId}/messages`, {
    errorMessage: "Failed to load messages",
  });
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export async function fetchMemoryEpisodes(projectId, limit = 20) {
  return requestOr(`/memory/episodes?project_id=${encodeURIComponent(projectId)}&limit=${limit}`, []);
}

export async function fetchMemoryConcepts(projectId, limit = 40) {
  return requestOr(`/memory/concepts?project_id=${encodeURIComponent(projectId)}&limit=${limit}`, []);
}

export async function fetchMemoryStats(projectId) {
  return requestOr(`/memory/stats?project_id=${encodeURIComponent(projectId)}`, {});
}

export async function fetchGraph(projectId, scope = "project") {
  const qs = scope === "all"
    ? "scope=all"
    : `project_id=${encodeURIComponent(projectId)}&scope=project`;
  return requestOr(`/graph?${qs}`, { nodes: [], edges: [] });
}

export async function fetchReflections(projectId, limit = 20) {
  return requestOr(`/consolidation/reflections?project_id=${encodeURIComponent(projectId)}&limit=${limit}`, []);
}

export async function fetchPinnedFacts() {
  return requestOr("/memory/pinned", []);
}

export async function deletePinnedFact(factId) {
  return request(`/memory/pinned/${factId}`, { method: "DELETE" });
}

// ─── Consolidation ────────────────────────────────────────────────────────────

export async function fetchConsolidationRuns(limit = 5) {
  return requestOr(`/consolidation/runs?limit=${limit}`, []);
}

export async function triggerConsolidation() {
  return request("/consolidation/run", { method: "POST" });
}

// ─── Router: providers, roles, usage ──────────────────────────────────────────

export async function fetchRouterConfig() {
  return requestOr("/router/config", null);
}

export async function transcribeAudio(blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  const formData = new FormData();
  formData.append("file", blob, `dictation.${ext}`);
  const res = await fetch(`${BASE}/voice/transcribe`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Transcription failed ${res.status}`);
  }
  return res.json(); // { text }
}

export async function fetchUsage(days = 7) {
  return requestOr(`/router/usage?days=${days}`, null);
}

export async function fetchRoles() {
  return requestOr("/router/roles", null);
}

export async function assignRole(roleId, provider, model) {
  return request(`/router/roles/${roleId}`, { method: "PUT", body: { provider, model } });
}

export async function resetRole(roleId) {
  return request(`/router/roles/${roleId}`, { method: "DELETE" });
}

export async function setProviderKey(providerId, key) {
  return request(`/router/providers/${providerId}/key`, { method: "PUT", body: { key } });
}

export async function removeProviderKey(providerId) {
  return request(`/router/providers/${providerId}/key`, { method: "DELETE" });
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function fetchProjects() {
  return request("/projects", { errorMessage: "Failed to load projects" });
}

export async function createProject(name, description = null) {
  return request("/projects", { method: "POST", body: { name, description } });
}

export async function updateProject(projectId, { name, description } = {}) {
  const body = {};
  if (name != null) body.name = name;
  if (description != null) body.description = description;
  return request(`/projects/${projectId}`, { method: "PATCH", body });
}

export async function deleteProject(projectId) {
  return request(`/projects/${projectId}`, { method: "DELETE" });
}
