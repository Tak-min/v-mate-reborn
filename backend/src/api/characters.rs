use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::models::Character;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(get_one).put(update).delete(remove))
}

#[derive(Deserialize)]
struct CharacterInput {
    name: String,
    color: Option<String>,
    model_file: Option<String>,
    voice_id: Option<String>,
}

#[derive(serde::Serialize)]
struct CharacterList {
    characters: Vec<Character>,
}

/// Returns built-in characters (`owner_id IS NULL`) plus any the user created.
async fn list(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<CharacterList>> {
    let characters: Vec<Character> = sqlx::query_as(
        "SELECT * FROM characters WHERE owner_id IS NULL OR owner_id = $1 ORDER BY created_at",
    )
    .bind(user.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(CharacterList { characters }))
}

async fn create(State(state): State<AppState>, user: AuthUser, Json(input): Json<CharacterInput>) -> AppResult<Json<Character>> {
    let slug = slugify(&input.name);

    let character: Character = sqlx::query_as(
        "INSERT INTO characters (owner_id, slug, name, color, model_file, voice_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(user.user_id)
    .bind(&slug)
    .bind(&input.name)
    .bind(input.color.unwrap_or_else(|| "#8b5cf6".into()))
    .bind(input.model_file.unwrap_or_else(|| "default.vrm".into()))
    .bind(input.voice_id.unwrap_or_else(|| "21m00Tcm4TlvDq8ikWAM".into()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(character))
}

async fn get_one(State(state): State<AppState>, user: AuthUser, Path(id): Path<Uuid>) -> AppResult<Json<Character>> {
    let character = fetch_owned_or_global(&state, user.user_id, id).await?;
    Ok(Json(character))
}

async fn update(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<CharacterInput>,
) -> AppResult<Json<Character>> {
    let existing = fetch_owned_or_global(&state, user.user_id, id).await?;
    if existing.owner_id != Some(user.user_id) {
        return Err(AppError::Forbidden);
    }

    let character: Character = sqlx::query_as(
        "UPDATE characters SET name = $1, color = $2, model_file = $3, voice_id = $4 \
         WHERE id = $5 RETURNING *",
    )
    .bind(&input.name)
    .bind(input.color.unwrap_or(existing.color))
    .bind(input.model_file.unwrap_or(existing.model_file))
    .bind(input.voice_id.unwrap_or(existing.voice_id))
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(character))
}

async fn remove(State(state): State<AppState>, user: AuthUser, Path(id): Path<Uuid>) -> AppResult<Json<serde_json::Value>> {
    let existing = fetch_owned_or_global(&state, user.user_id, id).await?;
    if existing.owner_id != Some(user.user_id) {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM characters WHERE id = $1").bind(id).execute(&state.db).await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn fetch_owned_or_global(state: &AppState, user_id: Uuid, id: Uuid) -> AppResult<Character> {
    let character: Option<Character> = sqlx::query_as(
        "SELECT * FROM characters WHERE id = $1 AND (owner_id IS NULL OR owner_id = $2)",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    character.ok_or(AppError::NotFound)
}

fn slugify(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        + "-"
        + &Uuid::new_v4().to_string()[..8]
}
