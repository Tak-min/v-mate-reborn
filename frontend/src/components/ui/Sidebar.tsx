import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/api/http';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useChatStore, type Character } from '@/store/chatStore';
import { useToastStore } from '@/store/toastStore';
import { BACKGROUND_PRESETS } from '@/config';
import '@/styles/tokens.css';
import './sidebar.css';

const BACKGROUND_LABELS: Record<string, string> = {
  'gradient-blue': 'ブルー',
  'gradient-sunset': 'サンセット',
  'gradient-night': 'ナイト',
  'gradient-mint': 'ミント',
};

interface UserSettingsResponse {
  background: string;
  volume: number;
  voice_speed: number;
}

/** Slide-out panel for character selection, appearance settings, and account actions. */
export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);

  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const refreshToken = useAuthStore((state) => state.refreshToken);

  const background = useSettingsStore((state) => state.background);
  const volume = useSettingsStore((state) => state.volume);
  const voiceSpeed = useSettingsStore((state) => state.voiceSpeed);
  const setBackground = useSettingsStore((state) => state.setBackground);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const setVoiceSpeed = useSettingsStore((state) => state.setVoiceSpeed);

  const characters = useChatStore((state) => state.characters);
  const currentCharacter = useChatStore((state) => state.currentCharacter);
  const setCurrentCharacter = useChatStore((state) => state.setCurrentCharacter);

  useEffect(() => {
    apiFetch<UserSettingsResponse>('/api/user/settings')
      .then((settings) => {
        setBackground(settings.background);
        setVolume(settings.volume);
        setVoiceSpeed(settings.voice_speed);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistSettings(next: Partial<UserSettingsResponse>) {
    apiFetch('/api/user/settings', {
      method: 'PUT',
      body: JSON.stringify({
        background: next.background ?? background,
        volume: next.volume ?? volume,
        voice_speed: next.voice_speed ?? voiceSpeed,
      }),
    }).catch(() => pushToast('設定の保存に失敗しました', 'error'));
  }

  function handleBackgroundChange(value: string) {
    setBackground(value);
    persistSettings({ background: value });
  }

  function handleVolumeChange(value: number) {
    setVolume(value);
    persistSettings({ volume: value });
  }

  function handleVoiceSpeedChange(value: number) {
    setVoiceSpeed(value);
    persistSettings({ voice_speed: value });
  }

  function handleSelectCharacter(character: Character) {
    setCurrentCharacter(character);
    setIsOpen(false);
  }

  async function handleLogout() {
    try {
      if (refreshToken) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {
      // best-effort: still clear local session
    } finally {
      clearAuth();
      navigate('/login');
    }
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={isOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} aria-hidden={!isOpen}>
        <header className="sidebar-header">
          <p className="sidebar-user">{user?.display_name ?? user?.email}</p>
        </header>

        <section className="sidebar-section" aria-labelledby="sidebar-characters-heading">
          <h2 id="sidebar-characters-heading">キャラクター</h2>
          <ul className="character-list">
            {characters.map((character) => (
              <li key={character.id}>
                <button
                  type="button"
                  className={`character-item ${currentCharacter?.id === character.id ? 'character-item--active' : ''}`}
                  style={{ '--character-color': character.color } as React.CSSProperties}
                  onClick={() => handleSelectCharacter(character)}
                >
                  {character.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sidebar-section" aria-labelledby="sidebar-appearance-heading">
          <h2 id="sidebar-appearance-heading">外観</h2>

          <label className="sidebar-field">
            <span>背景</span>
            <select value={background} onChange={(e) => handleBackgroundChange(e.target.value)}>
              {Object.keys(BACKGROUND_PRESETS).map((key) => (
                <option key={key} value={key}>
                  {BACKGROUND_LABELS[key] ?? key}
                </option>
              ))}
            </select>
          </label>

          <label className="sidebar-field">
            <span>音量 {Math.round(volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
            />
          </label>

          <label className="sidebar-field">
            <span>声の速さ {voiceSpeed.toFixed(1)}x</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={voiceSpeed}
              onChange={(e) => handleVoiceSpeedChange(Number(e.target.value))}
            />
          </label>
        </section>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          ログアウト
        </button>
      </aside>
    </>
  );
}
