pub mod jwt;
pub mod oauth;
pub mod password;

use axum::extract::{FromRef, FromRequestParts};
use axum::http::request::Parts;
use uuid::Uuid;

use crate::error::AppError;
use crate::state::AppState;

/// Extractor that requires a valid `Authorization: Bearer <access-token>` header.
/// Use as a handler argument: `async fn handler(user: AuthUser, ...)`.
pub struct AuthUser {
    pub user_id: Uuid,
}

#[async_trait::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = header.strip_prefix("Bearer ").ok_or(AppError::Unauthorized)?;
        let claims = jwt::verify(&app_state.config.jwt_secret, token, jwt::TokenType::Access)?;

        Ok(AuthUser { user_id: claims.sub })
    }
}
