/** Auth service — manages JWT tokens in localStorage. */
import { BACKEND_URL } from '../config.js';

const KEYS = { access: 'access_token', refresh: 'refresh_token', user: 'user' };

export const authService = {
  getAccessToken: () => localStorage.getItem(KEYS.access),
  getRefreshToken: () => localStorage.getItem(KEYS.refresh),
  getUser: () => { try { return JSON.parse(localStorage.getItem(KEYS.user)); } catch { return null; } },
  isAuthenticated: () => !!localStorage.getItem(KEYS.access),

  setTokens({ access_token, refresh_token, user }) {
    localStorage.setItem(KEYS.access, access_token);
    if (refresh_token) localStorage.setItem(KEYS.refresh, refresh_token);
    if (user) localStorage.setItem(KEYS.user, JSON.stringify(user));
  },

  clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  },

  async logout() {
    const token = this.getAccessToken();
    if (token) {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    this.clear();
  },

  /** Return a valid access token, refreshing if needed. */
  async validToken() {
    const at = this.getAccessToken();
    if (!at) return null;
    // Try to decode expiry without a library
    try {
      const payload = JSON.parse(atob(at.split('.')[1]));
      if (payload.exp * 1000 > Date.now() + 60_000) return at;
    } catch { return at; }
    return await this._doRefresh();
  },

  async _doRefresh() {
    const rt = this.getRefreshToken();
    if (!rt) { this.clear(); return null; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) { this.clear(); return null; }
      const data = await res.json();
      localStorage.setItem(KEYS.access, data.access_token);
      return data.access_token;
    } catch { return null; }
  },
};
