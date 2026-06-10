import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/api/http';
import { useAuthStore } from '@/store/authStore';
import '@/styles/tokens.css';
import './auth.css';

interface MeResponse {
  id: string;
  email: string;
  display_name: string;
}

/** Lands here after Google OAuth; stores the tokens issued by the backend redirect and loads the user profile. */
export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      navigate('/login', { replace: true });
      return;
    }

    useAuthStore.setState({ accessToken, refreshToken });

    apiFetch<MeResponse>('/api/auth/me')
      .then((user) => {
        setTokens(accessToken, refreshToken, user);
        navigate('/', { replace: true });
      })
      .catch(() => {
        useAuthStore.getState().clear();
        navigate('/login', { replace: true });
      });
  }, [searchParams, navigate, setTokens]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="auth-title">ログイン中...</p>
      </div>
    </div>
  );
}
