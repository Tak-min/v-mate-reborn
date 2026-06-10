import { useAuthStore } from '@/store/authStore';

let refreshPromise: Promise<string | null> | null = null;

/** Exchanges the stored refresh token for a new access token, deduping concurrent calls. */
async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccessToken, clear } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clear();
          return null;
        }
        const data = await res.json();
        setAccessToken(data.access_token);
        useAuthStore.setState({ refreshToken: data.refresh_token });
        return data.access_token as string;
      })
      .finally(() => { refreshPromise = null; });
  }

  return refreshPromise;
}

/** Fetch wrapper that injects the access token and retries once after a refresh on 401. */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res = await fetch(path, { ...options, headers });

  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(path, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
