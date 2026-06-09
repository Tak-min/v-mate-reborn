"""Conversation memory backed by SQLite."""
import os
import sqlite3
import logging
from typing import Optional

from backend.config import DATABASE_PATH

logger = logging.getLogger(__name__)

_DDL = """
CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    role        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    emotion     TEXT,
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_info (
    session_id      TEXT PRIMARY KEY,
    name            TEXT,
    context_data    TEXT,
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


class MemoryManager:
    def __init__(self, db_path: str = DATABASE_PATH):
        self.db_path = os.path.abspath(db_path)
        self._init_db()

    def _init_db(self) -> None:
        db_dir = os.path.dirname(self.db_path)
        os.makedirs(db_dir, exist_ok=True)
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.executescript(_DDL)
        except sqlite3.Error as exc:
            logger.error("DB init failed: %s — falling back to :memory:", exc)
            self.db_path = ":memory:"
            with sqlite3.connect(self.db_path) as conn:
                conn.executescript(_DDL)

    def save(self, session_id: str, role: str, content: str, emotion: Optional[str] = None) -> None:
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT INTO conversations (session_id, role, content, emotion) VALUES (?,?,?,?)",
                    (session_id, role, content, emotion),
                )
        except sqlite3.Error as exc:
            logger.error("Failed to save message: %s", exc)

    def history(self, session_id: str, limit: int = 20) -> list[dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute(
                    "SELECT role, content, emotion, timestamp FROM conversations "
                    "WHERE session_id=? ORDER BY timestamp DESC LIMIT ?",
                    (session_id, limit),
                ).fetchall()
            return [
                {"role": r[0], "content": r[1], "emotion": r[2], "timestamp": r[3]}
                for r in reversed(rows)
            ]
        except sqlite3.Error as exc:
            logger.error("Failed to fetch history: %s", exc)
            return []
