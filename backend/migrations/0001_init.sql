CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    display_name  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE oauth_accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE user_settings (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    background   TEXT NOT NULL DEFAULT 'gradient-blue',
    volume       REAL NOT NULL DEFAULT 0.7,
    voice_speed  REAL NOT NULL DEFAULT 1.0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE characters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    slug        TEXT NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#8b5cf6',
    model_file  TEXT NOT NULL DEFAULT 'default.vrm',
    voice_id    TEXT NOT NULL DEFAULT '21m00Tcm4TlvDq8ikWAM',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content      TEXT NOT NULL,
    emotion      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user_character ON conversations (user_id, character_id, created_at);

-- Seed the default character so a fresh database has something to load.
INSERT INTO characters (slug, name, color, model_file, voice_id)
VALUES ('shiro', 'シロ', '#8b5cf6', 'default.vrm', '21m00Tcm4TlvDq8ikWAM');
