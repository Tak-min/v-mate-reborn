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

/** New account creation form. */
export function Register() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      setTokens(data.access_token, data.refresh_token, data.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">アカウントを作成</h1>

        <label className="auth-field">
          <span>表示名</span>
          <input
            type="text"
            required
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

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
          <span>パスワード（8文字以上）</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          登録
        </button>

        <div className="auth-divider">または</div>

        <a className="auth-google" href="/api/auth/google">
          Google でログイン
        </a>

        <p className="auth-switch">
          すでにアカウントをお持ちの方は <Link to="/login">ログイン</Link>
        </p>
      </form>
    </div>
  );
}
