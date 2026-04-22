/**
 * API Client
 * Centralized fetch wrapper for all backend API calls
 *
 * FIXES APPLIED:
 *  1. 401 redirect now uses a relative path that works whether the app is
 *     served from a file-server root or opened directly from the filesystem.
 *  2. After a 401 we still throw so callers know what happened instead of
 *     silently receiving `undefined`.
 *  3. 409 Conflict is no longer swallowed — the backend message is surfaced.
 *  4. Network errors produce a clear, actionable message.
 */

const API_BASE = 'https://project-manager-smv5.onrender.com/api';

// ─── Resolve the login page regardless of serving depth ──────────────────────
function getLoginPath() {
  // Works for: /index.html  /pages/dashboard.html  /pages/projects.html etc.
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  return depth > 0 ? '../'.repeat(depth) + 'index.html' : 'index.html';
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('pm_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  // Don't set Content-Type for FormData (let the browser set multipart boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch (networkErr) {
    // fetch() itself threw — server is unreachable
    throw new Error('Cannot connect to server. Please ensure the backend is running on port 5000.');
  }

  // Parse body — guard against empty 204 responses
  let data = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    // ── 401: clear session and redirect to login ──────────────────────────
    if (response.status === 401) {
      localStorage.removeItem('pm_token');
      localStorage.removeItem('pm_user');
      window.location.href = getLoginPath();
      // Still throw so any awaiting code knows this failed
      throw new Error(data.message || 'Session expired. Please log in again.');
    }

    // ── 409: duplicate resource (e.g. email already registered) ──────────
    if (response.status === 409) {
      throw new Error(data.message || 'A conflict occurred. The resource may already exist.');
    }

    // ── 500 and everything else ───────────────────────────────────────────
    throw new Error(data.message || `Request failed (HTTP ${response.status})`);
  }

  return data;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
// Named AuthAPI internally to avoid collision with the `Auth` object
// exported by utils.js (both scripts load on the same page).
const AuthAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login:    (data) => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(data) }),
  me:       ()     => apiFetch('/auth/me'),
  updateProfile:  (data) => apiFetch('/auth/profile',  { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) => apiFetch('/auth/password', { method: 'PUT', body: JSON.stringify(data) })
};

// ─── Projects API ─────────────────────────────────────────────────────────────
const Projects = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/projects${q ? '?' + q : ''}`);
  },
  stats:  ()         => apiFetch('/projects/stats'),
  get:    (id)       => apiFetch(`/projects/${id}`),
  create: (data)     => apiFetch('/projects',       { method: 'POST',   body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/projects/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id)       => apiFetch(`/projects/${id}`, { method: 'DELETE' })
};

// ─── Milestones API ───────────────────────────────────────────────────────────
const Milestones = {
  list:   (projectId) => apiFetch(`/milestones?projectId=${projectId}`),
  create: (data)      => apiFetch('/milestones',       { method: 'POST',   body: JSON.stringify(data) }),
  update: (id, data)  => apiFetch(`/milestones/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  delete: (id)        => apiFetch(`/milestones/${id}`, { method: 'DELETE' })
};

// ─── Tasks API ────────────────────────────────────────────────────────────────
const Tasks = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/tasks${q ? '?' + q : ''}`);
  },
  create: (data)     => apiFetch('/tasks',              { method: 'POST',  body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/tasks/${id}`,        { method: 'PUT',   body: JSON.stringify(data) }),
  toggle: (id)       => apiFetch(`/tasks/${id}/toggle`, { method: 'PATCH' }),
  delete: (id)       => apiFetch(`/tasks/${id}`,        { method: 'DELETE' })
};

// ─── Attachments API ──────────────────────────────────────────────────────────
const Attachments = {
  list: (projectId) => apiFetch(`/attachments?projectId=${projectId}`),
  uploadFile: (projectId, file, label) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (label) formData.append('label', label);
    return apiFetch('/attachments/file', { method: 'POST', body: formData });
  },
  addLink: (data) => apiFetch('/attachments/link', { method: 'POST', body: JSON.stringify(data) }),
  delete:  (id)   => apiFetch(`/attachments/${id}`, { method: 'DELETE' })
};

// Export to global scope (used by inline <script> blocks in HTML pages)
window.API = { Auth: AuthAPI, Projects, Milestones, Tasks, Attachments };
