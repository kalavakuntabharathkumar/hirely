// Every server call lives here. All requests send the custom CSRF header.
const BASE = "/api";

export const hooks = { onUnauthorized: () => {} };

export class ApiError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields; // per-field messages, e.g. { email: "..." }
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Requested-With": "hirely" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") hooks.onUnauthorized();
    const detail = data && data.detail;
    const message = typeof detail === "string" ? detail : (detail && detail.message) || "Something went wrong.";
    throw new ApiError(message, res.status, (detail && detail.errors) || {});
  }
  return data;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const api = {
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  logout: () => request("POST", "/auth/logout"),
  me: () => request("GET", "/auth/me"),
  dashboard: () => request("GET", "/dashboard"),
  listCandidates: (params) => request("GET", "/candidates" + query(params)),
  getCandidate: (id) => request("GET", `/candidates/${id}`),
  createCandidate: (body) => request("POST", "/candidates", body),
  updateCandidate: (id, body) => request("PUT", `/candidates/${id}`, body),
  archiveCandidate: (id) => request("DELETE", `/candidates/${id}`),
  moveStage: (id, stage) => request("POST", `/candidates/${id}/stage`, { stage }),
  addNote: (id, text) => request("POST", `/candidates/${id}/notes`, { text }),
  editNote: (noteId, text) => request("PUT", `/notes/${noteId}`, { text }),
  deleteNote: (noteId) => request("DELETE", `/notes/${noteId}`),
};
