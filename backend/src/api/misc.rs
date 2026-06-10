use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::AuthUser;
use crate::config::VOICE_IDS;
use crate::error::AppResult;
use crate::models::UserSettings;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/voices", get(voices))
        .route("/user/settings", get(get_settings).put(update_settings))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

#[derive(Serialize)]
struct VoiceList {
    voices: Vec<VoiceEntry>,
}

#[derive(Serialize)]
struct VoiceEntry {
    character_id: &'static str,
    voice_id: &'static str,
}

async fn voices() -> Json<VoiceList> {
    let voices = VOICE_IDS
        .iter()
        .map(|(character_id, voice_id)| VoiceEntry { character_id, voice_id })
        .collect();

    Json(VoiceList { voices })
}

async fn get_settings(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<UserSettings>> {
    let settings: UserSettings = sqlx::query_as("SELECT * FROM user_settings WHERE user_id = $1")
        .bind(user.user_id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(settings))
}

#[derive(Deserialize)]
struct SettingsInput {
    background: Option<String>,
    volume: Option<f32>,
    voice_speed: Option<f32>,
}

async fn update_settings(
    State(state): State<AppState>,
    user: AuthUser,
    Json(input): Json<SettingsInput>,
) -> AppResult<Json<UserSettings>> {
    let current: UserSettings = sqlx::query_as("SELECT * FROM user_settings WHERE user_id = $1")
        .bind(user.user_id)
        .fetch_one(&state.db)
        .await?;

    let settings: UserSettings = sqlx::query_as(
        "UPDATE user_settings SET background = $1, volume = $2, voice_speed = $3, updated_at = now() \
         WHERE user_id = $4 RETURNING *",
    )
    .bind(input.background.unwrap_or(current.background))
    .bind(input.volume.unwrap_or(current.volume))
    .bind(input.voice_speed.unwrap_or(current.voice_speed))
    .bind(user.user_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(settings))
}
