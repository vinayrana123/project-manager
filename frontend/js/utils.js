/**
 * Utility Functions
 * Shared helpers used across all pages
 *
 * FIXES APPLIED:
 *  1. Auth.requireAuth() and Auth.redirectIfLoggedIn() now use relative paths
 *     so they work correctly from both / and /pages/ depth levels.
 */

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('pm_token'),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('pm_user')); }
    catch { return null; }
  },
  setSession: (token, user) => {
    localStorage.setItem('pm_token', token);
    localStorage.setItem('pm_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('pm_token');
    localStorage.removeItem('pm_user');
  },
  isLoggedIn: () => !!localStorage.getItem('pm_token'),

  /**
   * Redirect to the login page using a path relative to the current file.
   * Works whether the page is at /index.html or /pages/dashboard.html etc.
   */
  _loginPath: () => {
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    return depth > 0 ? '../'.repeat(depth) + 'index.html' : 'index.html';
  },

  /**
   * Guard protected pages. Returns false and redirects if not logged in.
   */
  requireAuth: () => {
    if (!localStorage.getItem('pm_token')) {
      window.location.href = Auth._loginPath();
      return false;
    }
    return true;
  },

  /**
   * On the login page, skip it if the user is already authenticated.
   * Redirects to pages/dashboard.html relative to the login page root.
   */
  redirectIfLoggedIn: () => {
    if (localStorage.getItem('pm_token')) {
      window.location.href = 'pages/dashboard.html';
      return true;
    }
    return false;
  }
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
const DateUtils = {
  format: (date, opts = {}) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', ...opts
    });
  },
  formatRelative: (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = d - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 7) return `${days}d left`;
    if (days <= 30) return `${Math.ceil(days / 7)}w left`;
    return `${Math.ceil(days / 30)}mo left`;
  },
  toInputDate: (date) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  },
  isOverdue: (date) => date && new Date(date) < new Date(),
  daysUntil: (date) => {
    if (!date) return null;
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  }
};

// ─── UI helpers ───────────────────────────────────────────────────────────────
const UI = {
  showToast: (message, type = 'success') => {
    const container = document.getElementById('toast-container') || (() => {
      const div = document.createElement('div');
      div.id = 'toast-container';
      div.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2';
      document.body.appendChild(div);
      return div;
    })();

    const icons  = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const colors = {
      success: 'bg-emerald-500',
      error:   'bg-red-500',
      warning: 'bg-amber-500',
      info:    'bg-blue-500'
    };

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-2xl
      ${colors[type]} transform translate-x-full transition-all duration-300 max-w-sm`;
    toast.innerHTML = `
      <span class="w-5 h-5 rounded-full bg-white bg-opacity-30 flex items-center justify-center text-xs font-bold shrink-0">
        ${icons[type]}
      </span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full');
    });

    setTimeout(() => {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  showModal: (id) => document.getElementById(id)?.classList.remove('hidden'),
  hideModal: (id) => document.getElementById(id)?.classList.add('hidden'),

  setLoading: (btnEl, loading, text = '') => {
    if (!btnEl) return;
    if (loading) {
      btnEl.dataset.originalText = btnEl.innerHTML;
      btnEl.disabled = true;
      btnEl.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> ${text || 'Loading...'}`;
    } else {
      btnEl.disabled = false;
      btnEl.innerHTML = btnEl.dataset.originalText || text;
    }
  },

  renderProgress: (percent, color = '#6366f1') => {
    const clamp = Math.min(100, Math.max(0, percent || 0));
    return `
      <div class="flex items-center gap-3">
        <div class="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
               style="width: ${clamp}%; background: ${color}"></div>
        </div>
        <span class="text-xs font-mono font-semibold opacity-70 w-8 text-right">${clamp}%</span>
      </div>
    `;
  },

  getPriorityBadge: (priority) => {
    const config = {
      low:      { color: 'text-slate-400 bg-slate-400/10', label: 'Low' },
      medium:   { color: 'text-blue-400 bg-blue-400/10',   label: 'Medium' },
      high:     { color: 'text-amber-400 bg-amber-400/10', label: 'High' },
      critical: { color: 'text-red-400 bg-red-400/10',     label: 'Critical' }
    };
    const c = config[priority] || config.medium;
    return `<span class="px-2 py-0.5 rounded-md text-xs font-medium ${c.color}">${c.label}</span>`;
  },

  getStatusBadge: (status) => {
    const config = {
      planning:  { color: 'text-slate-400 bg-slate-400/10',   label: 'Planning' },
      ongoing:   { color: 'text-blue-400 bg-blue-400/10',     label: 'Ongoing' },
      'on-hold': { color: 'text-amber-400 bg-amber-400/10',   label: 'On Hold' },
      completed: { color: 'text-emerald-400 bg-emerald-400/10', label: 'Completed' },
      cancelled: { color: 'text-red-400 bg-red-400/10',       label: 'Cancelled' }
    };
    const c = config[status] || config.planning;
    return `<span class="px-2 py-0.5 rounded-md text-xs font-medium ${c.color}">${c.label}</span>`;
  }
};

// ─── String helpers ───────────────────────────────────────────────────────────
const Str = {
  truncate: (str, len = 60) => str && str.length > len ? str.slice(0, len) + '…' : str || '',
  initials: (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?',
  fileIcon: (mimeType) => {
    if (!mimeType) return '📄';
    if (mimeType.includes('pdf'))    return '📕';
    if (mimeType.includes('image'))  return '🖼';
    if (mimeType.includes('word'))   return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('rar'))           return '🗜';
    if (mimeType.includes('text'))   return '📄';
    return '📁';
  }
};

window.Auth     = Auth;
window.DateUtils = DateUtils;
window.UI       = UI;
window.Str      = Str;
