use futures_util::{Stream, StreamExt};
use reqwest::Client;
use serde_json::{json, Value};

use crate::config::Config;
use crate::error::{AppError, AppResult};

const API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

/// Wraps Gemini's streaming `generateContent` endpoint with a
/// primary/fallback model strategy.
#[derive(Clone)]
pub struct AIConversationManager {
    http: Client,
    api_key: String,
    model: String,
    fallback_model: String,
}

impl AIConversationManager {
    pub fn new(config: &Config, http: Client) -> Self {
        Self {
            http,
            api_key: config.gemini_api_key.clone(),
            model: config.gemini_model.clone(),
            fallback_model: config.gemini_fallback_model.clone(),
        }
    }

    /// Streams text deltas for `prompt`. Tries the primary model first; if
    /// the request itself fails (e.g. quota/availability), retries once
    /// against the fallback model before giving up.
    pub async fn stream_response(&self, prompt: &str) -> AppResult<impl Stream<Item = String> + Send> {
        match self.open_stream(&self.model, prompt).await {
            Ok(stream) => Ok(stream),
            Err(_) => {
                tracing::warn!("primary model '{}' failed, falling back to '{}'", self.model, self.fallback_model);
                self.open_stream(&self.fallback_model, prompt).await
            }
        }
    }

    async fn open_stream(&self, model: &str, prompt: &str) -> AppResult<impl Stream<Item = String> + Send> {
        let url = format!("{API_BASE}/{model}:streamGenerateContent?alt=sse&key={}", self.api_key);
        let body = json!({ "contents": [{ "parts": [{ "text": prompt }] }] });

        let res = self.http.post(&url).json(&body).send().await
            .map_err(|e| AppError::Other(anyhow::anyhow!("gemini request failed: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Other(anyhow::anyhow!("gemini returned {}", res.status())));
        }

        let byte_stream = res.bytes_stream();
        Ok(sse_text_stream(byte_stream))
    }
}

/// Parses an SSE byte stream of Gemini `streamGenerateContent` events into
/// a stream of plain text deltas.
fn sse_text_stream(
    byte_stream: impl Stream<Item = reqwest::Result<bytes::Bytes>> + Send + 'static,
) -> impl Stream<Item = String> + Send {
    async_stream::stream! {
        let mut buf = String::new();
        futures_util::pin_mut!(byte_stream);

        while let Some(chunk) = byte_stream.next().await {
            let Ok(bytes) = chunk else { break };
            let Ok(text) = std::str::from_utf8(&bytes) else { continue };
            buf.push_str(text);

            while let Some(pos) = buf.find('\n') {
                let line = buf[..pos].trim().to_string();
                buf.drain(..=pos);

                let Some(data) = line.strip_prefix("data: ") else { continue };
                let Ok(value) = serde_json::from_str::<Value>(data) else { continue };

                let delta = extract_text(&value);
                if !delta.is_empty() {
                    yield delta;
                }
            }
        }
    }
}

fn extract_text(value: &Value) -> String {
    value["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or_default()
        .to_string()
}
