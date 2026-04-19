// src/api.js — BUGTRACKER v2 API Client
const BASE = "https://bugtracker-api-qqkx.onrender.com/api/v1";
const storage = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k => localStorage.removeItem(k),
};

export const getAccessToken  = ()  => storage.get("bt_access");
export const setAccessToken  = t   => storage.set("bt_access", t);
export const getRefreshToken = ()  => storage.get("bt_refresh");
export const setRefreshToken = t   => storage.set("bt_refresh", t);
export const clearTokens     = ()  => { storage.del("bt_access"); storage.del("bt_refresh"); storage.del("bt_user"); };
export const getStoredUser   = ()  => storage.get("bt_user");
export const setStoredUser   = u   => storage.set("bt_user", u);
export const getActiveWs     = ()  => storage.get("bt_active_ws");
export const setActiveWs     = id  => storage.set("bt_active_ws", id);

let refreshPromise = null;

async function apiFetch(path, opts = {}, retry = true) {
  const token = getAccessToken();
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401 && retry) {
    const refreshToken = getRefreshToken();
    if (!refreshToken) { clearTokens(); window.location.href = "/"; return; }

    if (!refreshPromise) {
      refreshPromise = fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).then(r => r.json()).finally(() => { refreshPromise = null; });
    }

    const data = await refreshPromise;
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      return apiFetch(path, opts, false);
    } else {
      clearTokens(); window.location.href = "/";
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || "Request failed"), { status: res.status, data: err });
  }
  if (res.status === 204) return null;
  return res.json();
}

const get   = (path, opts)       => apiFetch(path, { method: "GET",    ...opts });
const post  = (path, body, opts) => apiFetch(path, { method: "POST",   body: JSON.stringify(body), ...opts });
const patch = (path, body, opts) => apiFetch(path, { method: "PATCH",  body: JSON.stringify(body), ...opts });
const del   = (path, opts)       => apiFetch(path, { method: "DELETE", ...opts });

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  register:    data            => post("/auth/register", data),
  login:       (email, pass)   => post("/auth/login", { email, password: pass }),
  loginGoogle: credential      => post("/auth/google", { credential }),
  refresh:     rt              => post("/auth/refresh", { refreshToken: rt }),
  logout:      rt              => post("/auth/logout",  { refreshToken: rt }),
  me:          ()              => get("/auth/me"),
  bootstrap:   ()              => get("/auth/bootstrap"),
  updateMe:    data            => patch("/auth/me", data),
};

// ── Workspaces ────────────────────────────────────────────────
export const workspaces = {
  list:         ()             => get("/workspaces"),
  create:       data           => post("/workspaces", data),
  get:          id             => get(`/workspaces/${id}`),
  update:       (id, data)     => patch(`/workspaces/${id}`, data),
  delete:       id             => del(`/workspaces/${id}`),
  stats:        id             => get(`/workspaces/${id}/stats`),
  members:      id             => get(`/workspaces/${id}/members`),
  updateRole:   (id, uid, role) => patch(`/workspaces/${id}/members/${uid}/role`, { role }),
  removeMember: (id, uid)      => del(`/workspaces/${id}/members/${uid}`),
  invite:       (id, data)     => post(`/workspaces/${id}/invite`, data),
  invites:      id             => get(`/workspaces/${id}/invites`),
  cancelInvite: (id, inviteId) => del(`/workspaces/${id}/invites/${inviteId}`),
  acceptInvite: token          => post(`/workspaces/accept-invite/${token}`, {}),
};

// ── Projects ──────────────────────────────────────────────────
export const projects = {
  list:        (workspaceId)   => get(`/projects?workspaceId=${workspaceId}`),
  create:      data            => post("/projects", data),
  get:         id              => get(`/projects/${id}`),
  update:      (id, data)      => patch(`/projects/${id}`, data),
  delete:      id              => del(`/projects/${id}`),
  addMember:   (id, data)      => post(`/projects/${id}/members`, data),
  removeMember:(id, uid)       => del(`/projects/${id}/members/${uid}`),
  stats:       id              => get(`/projects/${id}/stats`),
  activity:    id              => get(`/projects/${id}/activity`),
};

// ── Epics ─────────────────────────────────────────────────────
export const epics = {
  list:   projectId            => get(`/projects/${projectId}/epics`),
  create: (projectId, data)    => post(`/projects/${projectId}/epics`, data),
  update: (id, data)           => patch(`/epics/${id}`, data),
  delete: id                   => del(`/epics/${id}`),
};

// ── Tickets ───────────────────────────────────────────────────
export const tickets = {
  list:    (projectId, params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v)));
    return get(`/projects/${projectId}/tickets${q.toString() ? "?" + q : ""}`);
  },
  create:        (projectId, data) => post(`/projects/${projectId}/tickets`, data),
  get:           id               => get(`/tickets/${id}`),
  update:        (id, data)       => patch(`/tickets/${id}`, data),
  delete:        id               => del(`/tickets/${id}`),
  addComment:    (id, body)       => post(`/tickets/${id}/comments`, { body }),
  editComment:   (id, cid, body)  => patch(`/tickets/${id}/comments/${cid}`, { body }),
  deleteComment: (id, cid)        => del(`/tickets/${id}/comments/${cid}`),
};

// ── Tokens ────────────────────────────────────────────────────
export const tokens = {
  list:   ()     => get("/tokens"),
  create: data   => post("/tokens", data),
  revoke: id     => del(`/tokens/${id}`),
  verify: ()     => get("/tokens/verify"),
};

// ── Users ─────────────────────────────────────────────────────
export const users = {
  list:    ()         => get("/users"),
  get:     id         => get(`/users/${id}`),
  setRole: (id, role) => patch(`/users/${id}/role`, { role }),
};
