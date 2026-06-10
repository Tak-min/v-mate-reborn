use serde::Deserialize;

use crate::config::Config;
use crate::error::{AppError, AppResult};

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v3/userinfo";

#[derive(Debug, Deserialize)]
pub struct GoogleUserInfo {
    pub sub: String,
    pub email: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
}

/// Builds the URL the browser should be redirected to in order to start the
/// Google OAuth consent flow.
pub fn authorize_url(config: &Config, state: &str) -> String {
    let mut url = reqwest::Url::parse(AUTH_URL).expect("valid url");
    url.query_pairs_mut()
        .append_pair("client_id", &config.google_client_id)
        .append_pair("redirect_uri", &config.google_redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile")
        .append_pair("state", state)
        .append_pair("access_type", "online")
        .append_pair("prompt", "select_account");
    url.to_string()
}

/// Exchanges an authorization code for the user's profile information.
pub async fn exchange_code(client: &reqwest::Client, config: &Config, code: &str) -> AppResult<GoogleUserInfo> {
    let token_res = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", config.google_client_id.as_str()),
            ("client_secret", config.google_client_secret.as_str()),
            ("redirect_uri", config.google_redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code", code),
        ])
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!("google token exchange failed: {e}")))?;

    if !token_res.status().is_success() {
        return Err(AppError::BadRequest("Google認証に失敗しました".into()));
    }

    let token: TokenResponse = token_res
        .json()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!("invalid token response: {e}")))?;

    let user_res = client
        .get(USERINFO_URL)
        .bearer_auth(&token.access_token)
        .send()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!("google userinfo failed: {e}")))?;

    user_res
        .json::<GoogleUserInfo>()
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!("invalid userinfo response: {e}")))
}
