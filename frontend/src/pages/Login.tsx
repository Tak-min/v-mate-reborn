import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '@/api/http';
import { useAuthStore } from '@/store/authStore';
import '@/styles/tokens.css';
import './auth.css';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; display_name: string };
}

/** Email/password sign-in, with a Google OAuth fallback. */
export function Login() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setTokens(data.access_token, data.refresh_token, data.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">V-Mate にログイン</h1>

        <label className="auth-field">
          <span>メールアドレス</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>パスワード</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          ログイン
        </button>

        <div className="auth-divider">または</div>

        <a className="auth-google" href="/api/auth/google">
          Google でログイン
        </a>

        <p className="auth-switch">
          アカウントをお持ちでない方は <Link to="/register">新規登録</Link>
        </p>
      </form>
    </div>
  );
}
