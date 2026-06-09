"""User model — SQLite CRUD for users, settings, characters, tokens."""
import os
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt

from backend import config

logger = logging.getLogger(__name__)

_SHIRO_PROMPT = config.SHIRO_PROMPT


def _conn(db_path: str) -> sqlite3.Connection:
    c = sqlite3.connect(db_path)
    c.execute("PRAGMA journal_mode=WAL")
    c.row_factory = sqlite3.Row
    return c


class UserModel:
    def __init__(self, db_path: str = config.DATABASE_PATH):
        self.db_path = os.path.abspath(db_path)
        self._init_tables()

    # ── Init ───────────────────────────────────────────────────────────────

    def _init_tables(self, _fallback: bool = False) -> None:
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        try:
            with _conn(self.db_path) as c:
                c.executescript(_SCHEMA)
            self._migrate(self.db_path)
        except sqlite3.Error as exc:
            logger.error("Table init failed: %s", exc)
            if not _fallback and self.db_path != "/tmp/memory.db":
                self.db_path = "/tmp/memory.db"
                self._init_tables(_fallback=True)

    @staticmethod
    def _migrate(db_path: str) -> None:
        with _conn(db_path) as c:
            cols = {r[1] for r in c.execute("PRAGMA table_info(users)")}
            if "avatar_url" not in cols:
                c.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")

    # ── Users ──────────────────────────────────────────────────────────────

    def create(self, username: str, email: str, password: str) -> Optional[int]:
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
        try:
            with _conn(self.db_path) as c:
                cur = c.execute(
                    "INSERT INTO users (username, email, password_hash) VALUES (?,?,?)",
                    (username, email, pw_hash),
                )
                uid = cur.lastrowid
                c.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", (uid,))
                c.execute(
                    "INSERT OR IGNORE INTO characters (user_id,name,vrm_file,prompt,voice_id,is_default) VALUES (?,?,?,?,?,?)",
                    (uid, "シロ", "Shiro.vrm", _SHIRO_PROMPT, config.VOICE_IDS.get("shiro", ""), 1),
                )
            return uid
        except sqlite3.IntegrityError:
            return None

    def verify_password(self, email: str, password: str) -> Optional[dict]:
        with _conn(self.db_path) as c:
            row = c.execute(
                "SELECT id,username,email,password_hash,is_active FROM users WHERE email=?", (email,)
            ).fetchone()
        if not row or not row["is_active"]:
            return None
        if bcrypt.checkpw(password.encode(), row["password_hash"]):
            return {"id": row["id"], "username": row["username"], "email": row["email"]}
        return None

    def touch_login(self, user_id: int) -> None:
        with _conn(self.db_path) as c:
            c.execute("UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?", (user_id,))

    def by_id(self, user_id: int) -> Optional[dict]:
        with _conn(self.db_path) as c:
            row = c.execute(
                "SELECT id,username,email,created_at,last_login,is_active FROM users WHERE id=?",
                (user_id,),
            ).fetchone()
        return dict(row) if row else None

    def by_email(self, email: str) -> Optional[dict]:
        with _conn(self.db_path) as c:
            row = c.execute(
                "SELECT id,username,email,created_at,last_login,is_active FROM users WHERE email=?",
                (email,),
            ).fetchone()
        return dict(row) if row else None

    # ── OAuth ──────────────────────────────────────────────────────────────

    def create_oauth(self, username: str, email: str, provider: str, provider_uid: str, avatar_url: str = None) -> Optional[int]:
        try:
            with _conn(self.db_path) as c:
                cur = c.execute(
                    "INSERT INTO users (username,email,password_hash,avatar_url,is_verified) VALUES (?,?,NULL,?,1)",
                    (username, email, avatar_url),
                )
                uid = cur.lastrowid
                c.execute("INSERT INTO oauth_accounts (user_id,provider,provider_user_id) VALUES (?,?,?)", (uid, provider, provider_uid))
                c.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", (uid,))
                c.execute(
                    "INSERT OR IGNORE INTO characters (user_id,name,vrm_file,prompt,voice_id,is_default) VALUES (?,?,?,?,?,?)",
                    (uid, "シロ", "Shiro.vrm", _SHIRO_PROMPT, config.VOICE_IDS.get("shiro", ""), 1),
                )
            return uid
        except sqlite3.IntegrityError:
            return None

    def by_oauth(self, provider: str, provider_uid: str) -> Optional[dict]:
        with _conn(self.db_path) as c:
            row = c.execute(
                "SELECT u.* FROM users u JOIN oauth_accounts o ON u.id=o.user_id "
                "WHERE o.provider=? AND o.provider_user_id=?",
                (provider, provider_uid),
            ).fetchone()
        return dict(row) if row else None

    def link_oauth(self, user_id: int, provider: str, provider_uid: str, avatar_url: str = None) -> None:
        with _conn(self.db_path) as c:
            c.execute("INSERT OR IGNORE INTO oauth_accounts (user_id,provider,provider_user_id) VALUES (?,?,?)", (user_id, provider, provider_uid))
            if avatar_url:
                c.execute("UPDATE users SET avatar_url=? WHERE id=?", (avatar_url, user_id))

    # ── Settings ───────────────────────────────────────────────────────────

    def settings(self, user_id: int) -> dict:
        with _conn(self.db_path) as c:
            row = c.execute("SELECT * FROM user_settings WHERE user_id=?", (user_id,)).fetchone()
            if not row:
                c.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", (user_id,))
                row = c.execute("SELECT * FROM user_settings WHERE user_id=?", (user_id,)).fetchone()
        if row:
            return {
                "character": row["character_preference"],
                "background": row["background_preference"],
                "volume": row["voice_volume"],
                "voiceSpeed": row["voice_speed"],
                "memoryEnabled": bool(row["memory_enabled"]),
                "use3DUI": bool(row["use_3d_ui"]),
            }
        return {"character": "Shiro.vrm", "background": "sky.jpg", "volume": 0.7, "voiceSpeed": 1.0, "memoryEnabled": True, "use3DUI": True}

    def update_settings(self, user_id: int, data: dict) -> None:
        with _conn(self.db_path) as c:
            c.execute(
                "UPDATE user_settings SET character_preference=?,background_preference=?,voice_volume=?,voice_speed=?,memory_enabled=?,use_3d_ui=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
                (data.get("character", "Shiro.vrm"), data.get("background", "sky.jpg"), data.get("volume", 0.7), data.get("voiceSpeed", 1.0), data.get("memoryEnabled", True), data.get("use3DUI", True), user_id),
            )

    # ── Tokens ─────────────────────────────────────────────────────────────

    def save_token(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        with _conn(self.db_path) as c:
            c.execute("INSERT INTO refresh_tokens (user_id,token_hash,expires_at) VALUES (?,?,?)", (user_id, token_hash, expires_at.isoformat()))

    def verify_token(self, token_hash: str) -> Optional[int]:
        with _conn(self.db_path) as c:
            row = c.execute("SELECT user_id,expires_at FROM refresh_tokens WHERE token_hash=?", (token_hash,)).fetchone()
        if not row:
            return None
        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            return None
        return row["user_id"]

    def delete_token(self, token_hash: str) -> None:
        with _conn(self.db_path) as c:
            c.execute("DELETE FROM refresh_tokens WHERE token_hash=?", (token_hash,))

    def delete_all_tokens(self, user_id: int) -> None:
        with _conn(self.db_path) as c:
            c.execute("DELETE FROM refresh_tokens WHERE user_id=?", (user_id,))

    # ── Characters ─────────────────────────────────────────────────────────

    def characters(self, user_id: int) -> list[dict]:
        with _conn(self.db_path) as c:
            rows = c.execute(
                "SELECT * FROM characters WHERE user_id=? ORDER BY is_default DESC, created_at ASC", (user_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def character_by_id(self, character_id: int) -> Optional[dict]:
        with _conn(self.db_path) as c:
            row = c.execute("SELECT * FROM characters WHERE id=?", (character_id,)).fetchone()
        return dict(row) if row else None

    def create_character(self, user_id: int, name: str, vrm_file: str, prompt: str, voice_id: str, is_default: bool = False) -> Optional[int]:
        try:
            with _conn(self.db_path) as c:
                if is_default:
                    c.execute("UPDATE characters SET is_default=0 WHERE user_id=?", (user_id,))
                cur = c.execute(
                    "INSERT INTO characters (user_id,name,vrm_file,prompt,voice_id,is_default) VALUES (?,?,?,?,?,?)",
                    (user_id, name, vrm_file, prompt, voice_id, int(is_default)),
                )
            return cur.lastrowid
        except sqlite3.Error as exc:
            logger.error("create_character: %s", exc)
            return None

    def update_character(self, character_id: int, **fields) -> bool:
        allowed = {"name", "prompt", "voice_id", "is_default"}
        updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
        if not updates:
            return False
        try:
            with _conn(self.db_path) as c:
                if updates.get("is_default"):
                    row = c.execute("SELECT user_id FROM characters WHERE id=?", (character_id,)).fetchone()
                    if row:
                        c.execute("UPDATE characters SET is_default=0 WHERE user_id=?", (row["user_id"],))
                sets = ", ".join(f"{k}=?" for k in updates) + ", updated_at=CURRENT_TIMESTAMP"
                c.execute(f"UPDATE characters SET {sets} WHERE id=?", (*updates.values(), character_id))
            return True
        except sqlite3.Error as exc:
            logger.error("update_character: %s", exc)
            return False

    def delete_character(self, character_id: int) -> bool:
        try:
            with _conn(self.db_path) as c:
                c.execute("DELETE FROM characters WHERE id=?", (character_id,))
            return True
        except sqlite3.Error:
            return False


# ── Schema ─────────────────────────────────────────────────────────────────
_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT,
    avatar_url    TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login    DATETIME,
    is_active     BOOLEAN  DEFAULT 1,
    is_verified   BOOLEAN  DEFAULT 0
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    provider         TEXT    NOT NULL,
    provider_user_id TEXT    NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS user_settings (
    user_id               INTEGER PRIMARY KEY,
    character_preference  TEXT    DEFAULT 'Shiro.vrm',
    background_preference TEXT    DEFAULT 'sky.jpg',
    voice_volume          REAL    DEFAULT 0.7,
    voice_speed           REAL    DEFAULT 1.0,
    memory_enabled        BOOLEAN DEFAULT 1,
    use_3d_ui             BOOLEAN DEFAULT 1,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS characters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    vrm_file   TEXT    NOT NULL,
    prompt     TEXT    NOT NULL,
    voice_id   TEXT    NOT NULL DEFAULT '',
    is_default BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_rt_user        ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_oa_user        ON oauth_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_ch_user        ON characters (user_id);
"""
