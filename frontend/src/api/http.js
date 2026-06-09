/** fetch wrapper that injects auth headers automatically. */
import { BACKEND_URL } from '../config.js';
import { authService } from './auth.js';

export async function apiFetch(path, options = {}) {
  const token = await authService.validToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
  }
  return res.json();
}
