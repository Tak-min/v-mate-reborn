use std::path::Path;

use reqwest::Client;
use serde_json::json;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

const ELEVENLABS_BASE: &str = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID: &str = "eleven_turbo_v2_5";

/// Synthesizes `text` with ElevenLabs and writes the resulting MP3 into
/// `audio_dir`, returning a `/audio/<file>.mp3` URL the frontend can play.
#[derive(Clone)]
pub struct TtsService {
    http: Client,
    api_key: String,
    audio_dir: std::path::PathBuf,
}

impl TtsService {
    pub fn new(http: Client, api_key: String, audio_dir: std::path::PathBuf) -> Self {
        Self { http, api_key, audio_dir }
    }

    pub async fn synthesize(&self, text: &str, voice_id: &str) -> AppResult<String> {
        let url = format!("{ELEVENLABS_BASE}/{voice_id}?optimize_streaming_latency=3");

        let body = json!({
            "text": text,
            "model_id": MODEL_ID,
            "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 },
        });

        let res = self
            .http
            .post(&url)
            .header("xi-api-key", &self.api_key)
            .header("Accept", "audio/mpeg")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("elevenlabs request failed: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Other(anyhow::anyhow!("elevenlabs returned {}", res.status())));
        }

        let bytes = res
            .bytes()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("failed reading audio bytes: {e}")))?;

        let filename = format!("{}.mp3", Uuid::new_v4());
        let path: &Path = &self.audio_dir.join(&filename);
        tokio::fs::write(path, &bytes)
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("failed writing audio file: {e}")))?;

        Ok(format!("/audio/{filename}"))
    }
}
