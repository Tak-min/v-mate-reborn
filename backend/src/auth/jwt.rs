use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub typ: TokenType,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TokenType {
    Access,
    Refresh,
}

pub struct IssuedRefresh {
    /// The opaque token returned to the client.
    pub token: String,
    /// SHA-256 hex digest stored in the database (never store the raw token).
    pub token_hash: String,
    pub expires_at: chrono::DateTime<Utc>,
}

pub fn issue_access(secret: &str, user_id: Uuid, minutes: i64) -> String {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id,
        typ: TokenType::Access,
        iat: now.timestamp(),
        exp: (now + Duration::minutes(minutes)).timestamp(),
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .expect("jwt encoding should not fail")
}

/// Issues a refresh token: a random opaque string, JWT-wrapped for the client
/// but tracked server-side via its hash so it can be revoked.
pub fn issue_refresh(secret: &str, user_id: Uuid, days: i64) -> IssuedRefresh {
    let now = Utc::now();
    let expires_at = now + Duration::days(days);

    let mut nonce = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce);
    let nonce_hex = hex::encode(nonce);

    let claims = serde_json::json!({
        "sub": user_id,
        "typ": "refresh",
        "nonce": nonce_hex,
        "iat": now.timestamp(),
        "exp": expires_at.timestamp(),
    });

    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .expect("jwt encoding should not fail");

    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    IssuedRefresh { token, token_hash, expires_at }
}

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn verify(secret: &str, token: &str, expected: TokenType) -> AppResult<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized)?;

    if data.claims.typ != expected {
        return Err(AppError::Unauthorized);
    }

    Ok(data.claims)
}
