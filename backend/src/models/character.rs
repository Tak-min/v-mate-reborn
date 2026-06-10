use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Character {
    pub id: Uuid,
    pub owner_id: Option<Uuid>,
    pub slug: String,
    pub name: String,
    pub color: String,
    pub model_file: String,
    pub voice_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct UserSettings {
    pub user_id: Uuid,
    pub background: String,
    pub volume: f32,
    pub voice_speed: f32,
    pub updated_at: DateTime<Utc>,
}
