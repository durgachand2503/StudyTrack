/* StudyTrack - Core Utilities */

const API_BASE = (import.meta.env?.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` : '/api');

// ── Token Management ──
function getAccessToken() {
  return localStorage.getItem('st_access_token');
}

function getRefreshToken() {
  return localStorage.getItem('st_refresh_token');
}

function setTokens(accessToken, refreshToken) {
  localStorage.setItem('st_access_token', accessToken);
  if (refreshToken) localStorage.setItem('st_refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('st_access_token');
  localStorage.removeItem('st_refresh_token');
  localStorage.removeItem('st_user');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('st_user'));
  } catch { return null; }
}

function setStoredUser(user) {
  localStorage.setItem('st_user', JSON.stringify(user));
}

// ── API Client ──
let isRefreshing = false;

const api = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    };

    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (let browser handle boundary)
    if (config.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register') || endpoint.startsWith('/auth/refresh');

    try {
      let response = await fetch(url, config);

      // Handle token expiration - retry once for protected endpoints
      if (response.status === 401 && !isAuthEndpoint && !isRefreshing) {
        let errorData = null;
        try {
          errorData = await response.clone().json();
        } catch {}

        if (errorData?.code === 'TOKEN_EXPIRED' || errorData?.code === 'INVALID_TOKEN') {
          const refreshed = await api.refreshToken();
          if (refreshed) {
            config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
            response = await fetch(url, config);
          } else {
            clearTokens();
            if (window.location.pathname.includes('dashboard')) {
              window.location.href = '/';
            }
            throw new Error('Your session has expired. Please sign in again.');
          }
        } else if (errorData?.code === 'NO_TOKEN' || errorData?.code === 'USER_NOT_FOUND') {
          clearTokens();
          if (window.location.pathname.includes('dashboard')) {
            window.location.href = '/';
          }
          throw new Error(errorData?.message || 'Session expired.');
        }
      }

      let result;
      try {
        result = await response.json();
      } catch {
        result = { success: response.ok, message: response.statusText };
      }

      if (!response.ok) {
        throw new Error(result.message || 'Request failed');
      }

      return result;
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please check your connection.');
      }
      throw error;
    }
  },

  async refreshToken() {
    if (isRefreshing) return false;
    isRefreshing = true;

    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.success && data.data.accessToken) {
        setTokens(data.data.accessToken, data.data.refreshToken || refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
    }
  },

  // Convenience methods
  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  },

  // Auth
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout', { refreshToken: getRefreshToken() }),

  // User
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  getNotifications: (page = 1) => api.get(`/users/notifications?page=${page}`),
  markNotificationRead: (id) => api.put(`/users/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/users/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/users/notifications/${id}`),
  clearAllNotifications: () => api.delete('/users/notifications'),

  // Tasks
  getTasks: (params = '') => api.get(`/tasks?${params}`),
  getTask: (id) => api.get(`/tasks/${id}`),
  createTask: (data) => api.post('/tasks', data),
  updateTask: (id, data) => api.put(`/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
  completeTask: (id) => api.put(`/tasks/${id}/complete`),
  reopenTask: (id) => api.put(`/tasks/${id}/reopen`),

  // Sessions
  getSessions: (params = '') => api.get(`/sessions?${params}`),
  getTodaySessions: (localDate) => api.get(`/sessions/today?localDate=${localDate}`),
  createSession: (data) => api.post('/sessions', data),

  // Analytics
  getStudyStats: (localDate) => api.get(`/analytics/study-stats?localDate=${localDate}`),
  getSubjectBreakdown: () => api.get('/analytics/subject-breakdown'),
  getWeeklyActivity: (localDate) => api.get(`/analytics/weekly-activity?localDate=${localDate}`),
  getHeatmapData: (localDate) => api.get(`/analytics/heatmap?localDate=${localDate}`),
  getTaskStats: () => api.get('/analytics/task-stats'),
  getMonthlyProductivity: (localDate) => api.get(`/analytics/monthly-productivity?localDate=${localDate}`),

  // Badges
  getBadges: () => api.get('/badges'),

  // Groups
  getGroups: (params = '') => api.get(`/groups?${params}`),
  getGroup: (id) => api.get(`/groups/${id}`),
  createGroup: (data) => api.post('/groups', data),
  updateGroup: (id, data) => api.put(`/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/groups/${id}`),
  joinGroup: (id) => api.post(`/groups/${id}/join`),
  leaveGroup: (id) => api.post(`/groups/${id}/leave`),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
  getGroupMessages: (groupId, page = 1) => api.get(`/groups/${groupId}/messages?page=${page}`),
  deleteGroupMessage: (groupId, messageId) => api.delete(`/groups/${groupId}/messages/${messageId}`),
  deleteGroupMessages: (groupId, params = '') => api.delete(`/groups/${groupId}/messages${params ? '?' + params : ''}`),

  // Channels
  getChannels: (params = '') => api.get(`/channels?${params}`),
  getChannel: (id) => api.get(`/channels/${id}`),
  createChannel: (data) => api.post('/channels', data),
  joinChannel: (id) => api.post(`/channels/${id}/join`),
  leaveChannel: (id) => api.post(`/channels/${id}/leave`),
  addResource: (channelId, data) => api.post(`/channels/${channelId}/resources`, data),
  removeResource: (channelId, resourceId) => api.delete(`/channels/${channelId}/resources/${resourceId}`),
  getChannelMessages: (channelId, page = 1) => api.get(`/channels/${channelId}/messages?page=${page}`),
  deleteChannelMessage: (channelId, messageId) => api.delete(`/channels/${channelId}/messages/${messageId}`),
  deleteChannelMessages: (channelId, params = '') => api.delete(`/channels/${channelId}/messages${params ? '?' + params : ''}`),

  // Assignments
  getAssignments: (params = '') => api.get(`/assignments?${params}`),
  getAssignment: (id) => api.get(`/assignments/${id}`),
  createAssignment: (data) => api.post('/assignments', data),
  updateAssignment: (id, data) => api.put(`/assignments/${id}`, data),
  deleteAssignment: (id) => api.delete(`/assignments/${id}`),
  getSubmissions: (assignmentId) => api.get(`/assignments/${assignmentId}/submissions`),
  gradeSubmission: (assignmentId, submissionId, data) =>
    api.put(`/assignments/${assignmentId}/submissions/${submissionId}/grade`, data)
};

// ── XSS Prevention ──
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ── Safe DOM Creation ──
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') el.className = val;
    else if (key === 'textContent') el.textContent = val;
    else if (key === 'innerHTML') el.innerHTML = val; // Use only for trusted content
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key === 'dataset') Object.assign(el.dataset, val);
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else el.setAttribute(key, val);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  }
  return el;
}

// ── Toast Notifications ──
let toastContainer = null;

function showToast(message, type = 'info', duration = 4000) {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = createElement('div', { id: 'toast-container', className: 'toast-container' });
      document.body.appendChild(toastContainer);
    }
  }

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  const toast = createElement('div', { className: `toast ${type}` }, [
    createElement('span', { className: 'toast-icon', textContent: icons[type] || icons.info }),
    createElement('span', { className: 'toast-message', textContent: message }),
    createElement('button', {
      className: 'toast-close',
      textContent: '✕',
      onClick: () => removeToast(toast)
    })
  ]);

  toastContainer.appendChild(toast);
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  if (toast && toast.parentNode) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }
}

// ── Modal ──
function showModal(content, options = {}) {
  const overlay = createElement('div', {
    className: 'modal-overlay',
    onClick: (e) => {
      if (e.target === overlay && options.closeOnOverlay !== false) {
        closeModal(overlay);
      }
    }
  }, [content]);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Focus trap
  const focusable = content.querySelectorAll('button, input, select, textarea, [tabindex]');
  if (focusable.length) focusable[0].focus();

  // Escape key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return overlay;
}

function closeModal(overlay) {
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  } else {
    const existing = document.querySelector('.modal-overlay');
    if (existing) {
      existing.remove();
      document.body.style.overflow = '';
    }
  }
}

// ── Date Formatting ──
function getLocalDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// ── Loading / Empty States ──
function showLoading(container) {
  container.innerHTML = '';
  const loader = createElement('div', {
    className: 'flex justify-center items-center',
    style: { padding: '3rem 0' }
  }, [
    createElement('div', { className: 'spinner spinner-lg' })
  ]);
  container.appendChild(loader);
}

function showEmpty(container, icon, title, text, action) {
  container.innerHTML = '';
  const emptyEl = createElement('div', { className: 'empty-state' }, [
    createElement('div', { className: 'empty-state-icon', textContent: icon }),
    createElement('div', { className: 'empty-state-title', textContent: title }),
    createElement('div', { className: 'empty-state-text', textContent: text })
  ]);
  if (action) {
    emptyEl.appendChild(action);
  }
  container.appendChild(emptyEl);
}

function showError(container, message, retryFn) {
  container.innerHTML = '';
  const errorEl = createElement('div', { className: 'empty-state' }, [
    createElement('div', { className: 'empty-state-icon', textContent: '⚠️' }),
    createElement('div', { className: 'empty-state-title', textContent: 'Something went wrong' }),
    createElement('div', { className: 'empty-state-text', textContent: message })
  ]);
  if (retryFn) {
    errorEl.appendChild(createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Try Again',
      onClick: retryFn
    }));
  }
  container.appendChild(errorEl);
}

// ── Debounce / Throttle ──
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, limit = 200) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ── Priority helpers ──
function priorityTag(priority) {
  const classes = {
    low: 'tag-info', medium: 'tag-warning', high: 'tag-danger', urgent: 'tag-danger'
  };
  return createElement('span', {
    className: `tag ${classes[priority] || 'tag-gray'}`,
    textContent: priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'None'
  });
}

function statusTag(status) {
  const classes = {
    pending: 'tag-gray', 'in-progress': 'tag-info', completed: 'tag-success', overdue: 'tag-danger'
  };
  const labels = {
    pending: 'Pending', 'in-progress': 'In Progress', completed: 'Completed', overdue: 'Overdue'
  };
  return createElement('span', {
    className: `tag ${classes[status] || 'tag-gray'}`,
    textContent: labels[status] || status
  });
}

// ── Export ──
export {
  api, escapeHtml, createElement, showToast, removeToast,
  showModal, closeModal,
  getLocalDateStr, formatDate, formatDateTime, formatDuration, timeAgo,
  showLoading, showEmpty, showError,
  debounce, throttle, priorityTag, statusTag,
  getAccessToken, getRefreshToken, setTokens, clearTokens,
  getStoredUser, setStoredUser
};
