use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct ConversationEntry {
    pub role: String,
    pub content: String,
    pub emotion: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Persists and retrieves per-user, per-character conversation history.
#[derive(Clone)]
pub struct MemoryManager {
    pool: PgPool,
}

impl MemoryManager {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn save(
        &self,
        user_id: Uuid,
        character_id: Uuid,
        role: &str,
        content: &str,
        emotion: Option<&str>,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO conversations (user_id, character_id, role, content, emotion) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(user_id)
        .bind(character_id)
        .bind(role)
        .bind(content)
        .bind(emotion)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Returns the most recent `limit` turns, oldest first.
    pub async fn history(&self, user_id: Uuid, character_id: Uuid, limit: i64) -> AppResult<Vec<ConversationEntry>> {
        let mut rows: Vec<ConversationEntry> = sqlx::query_as(
            "SELECT role, content, emotion, created_at FROM conversations \
             WHERE user_id = $1 AND character_id = $2 \
             ORDER BY created_at DESC LIMIT $3",
        )
        .bind(user_id)
        .bind(character_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        rows.reverse();
        Ok(rows)
    }

    /// Renders history as a flat transcript for prompt construction.
    pub fn format_history(history: &[ConversationEntry]) -> String {
        history
            .iter()
            .map(|e| {
                let speaker = if e.role == "user" { "ユーザー" } else { "あなた" };
                format!("{speaker}: {}", e.content)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}
