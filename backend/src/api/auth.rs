use axum::extract::{Query, State};
use axum::response::{IntoResponse, Redirect};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{jwt, oauth, password, AuthUser};
use crate::error::{AppError, AppResult};
use crate::models::User;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
        .route("/me", get(me))
        .route("/google", get(google_redirect))
        .route("/google/callback", get(google_callback))
}

#[derive(Deserialize)]
struct RegisterRequest {
    email: String,
    password: String,
    display_name: String,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct RefreshRequest {
    refresh_token: String,
}

#[derive(Serialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
    user: User,
}

async fn register(State(state): State<AppState>, Json(req): Json<RegisterRequest>) -> AppResult<Json<AuthResponse>> {
    if req.password.len() < 8 {
        return Err(AppError::BadRequest("パスワードは8文字以上で入力してください".into()));
    }

    let existing: Option<User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(&state.db)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict("このメールアドレスは既に登録されています".into()));
    }

    let hash = password::hash(&req.password)?;

    let user: User = sqlx::query_as(
        "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(&req.email)
    .bind(&hash)
    .bind(&req.display_name)
    .fetch_one(&state.db)
    .await?;

    sqlx::query("INSERT INTO user_settings (user_id) VALUES ($1)")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    issue_tokens(&state, user).await
}

async fn login(State(state): State<AppState>, Json(req): Json<LoginRequest>) -> AppResult<Json<AuthResponse>> {
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(&state.db)
        .await?;

    let user = user.ok_or(AppError::Unauthorized)?;

    let valid = user
        .password_hash
        .as_deref()
        .map(|h| password::verify(&req.password, h))
        .unwrap_or(false);

    if !valid {
        return Err(AppError::Unauthorized);
    }

    sqlx::query("UPDATE users SET last_login_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(user.id)
        .execute(&state.db)
        .await?;

    issue_tokens(&state, user).await
}

async fn refresh(State(state): State<AppState>, Json(req): Json<RefreshRequest>) -> AppResult<Json<AuthResponse>> {
    let token_hash = jwt::hash_token(&req.refresh_token);

    let row: Option<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM refresh_tokens \
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let (user_id,) = row.ok_or(AppError::Unauthorized)?;

    // Rotate: revoke the used refresh token before issuing a new one.
    sqlx::query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&state.db)
        .await?;

    let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;

    issue_tokens(&state, user).await
}

async fn logout(State(state): State<AppState>, Json(req): Json<RefreshRequest>) -> AppResult<impl IntoResponse> {
    let token_hash = jwt::hash_token(&req.refresh_token);
    sqlx::query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn me(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<User>> {
    let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user.user_id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(user))
}

async fn google_redirect(State(state): State<AppState>) -> impl IntoResponse {
    let state_token = jwt::issue_oauth_state(&state.config.jwt_secret);
    let url = oauth::authorize_url(&state.config, &state_token);
    Redirect::temporary(&url)
}

#[derive(Deserialize)]
struct GoogleCallbackParams {
    code: String,
    state: String,
}

async fn google_callback(
    State(state): State<AppState>,
    Query(params): Query<GoogleCallbackParams>,
) -> AppResult<impl IntoResponse> {
    jwt::verify_oauth_state(&state.config.jwt_secret, &params.state)?;

    let info = oauth::exchange_code(&state.http, &state.config, &params.code).await?;

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_id = $1",
    )
    .bind(&info.sub)
    .fetch_optional(&state.db)
    .await?;

    let user_id = match existing {
        Some((id,)) => id,
        None => {
            // Link to an existing email/password account if one matches, else create a new user.
            let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
                .bind(&info.email)
                .fetch_optional(&state.db)
                .await?;

            let user_id = match user {
                Some(u) => u.id,
                None => {
                    let created: User = sqlx::query_as(
                        "INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING *",
                    )
                    .bind(&info.email)
                    .bind(&info.name)
                    .fetch_one(&state.db)
                    .await?;

                    sqlx::query("INSERT INTO user_settings (user_id) VALUES ($1)")
                        .bind(created.id)
                        .execute(&state.db)
                        .await?;

                    created.id
                }
            };

            sqlx::query("INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES ($1, 'google', $2)")
                .bind(user_id)
                .bind(&info.sub)
                .execute(&state.db)
                .await?;

            user_id
        }
    };

    sqlx::query("UPDATE users SET last_login_at = $1 WHERE id = $2")
        .bind(Utc::now())
        .bind(user_id)
        .execute(&state.db)
        .await?;

    let user: User = sqlx::query_as("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;

    let access = jwt::issue_access(&state.config.jwt_secret, user.id, state.config.access_token_minutes);
    let refresh = jwt::issue_refresh(&state.config.jwt_secret, user.id, state.config.refresh_token_days);
    store_refresh_token(&state, user.id, &refresh).await?;

    Ok(Redirect::temporary(&format!(
        "/auth/callback?access_token={}&refresh_token={}",
        access, refresh.token
    )))
}

async fn issue_tokens(state: &AppState, user: User) -> AppResult<Json<AuthResponse>> {
    let access = jwt::issue_access(&state.config.jwt_secret, user.id, state.config.access_token_minutes);
    let refresh = jwt::issue_refresh(&state.config.jwt_secret, user.id, state.config.refresh_token_days);
    store_refresh_token(state, user.id, &refresh).await?;

    Ok(Json(AuthResponse { access_token: access, refresh_token: refresh.token, user }))
}

async fn store_refresh_token(state: &AppState, user_id: Uuid, refresh: &jwt::IssuedRefresh) -> AppResult<()> {
    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(&refresh.token_hash)
        .bind(refresh.expires_at)
        .execute(&state.db)
        .await?;

    Ok(())
}
