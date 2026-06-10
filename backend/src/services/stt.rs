use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;
use serde_json::json;

use crate::error::{AppError, AppResult};

const UPLOAD_URL: &str = "https://api.assemblyai.com/v2/upload";
const TRANSCRIPT_URL: &str = "https://api.assemblyai.com/v2/transcript";
const POLL_INTERVAL: Duration = Duration::from_millis(750);
const MAX_POLLS: usize = 40; // ~30s

#[derive(Deserialize)]
struct UploadResponse {
    upload_url: String,
}

#[derive(Deserialize)]
struct TranscriptResponse {
    id: String,
    status: String,
    text: Option<String>,
    error: Option<String>,
}

/// Transcribes raw audio bytes (e.g. webm/opus from the browser's
/// MediaRecorder) to Japanese text via AssemblyAI.
#[derive(Clone)]
pub struct SttService {
    http: Client,
    api_key: String,
}

impl SttService {
    pub fn new(http: Client, api_key: String) -> Self {
        Self { http, api_key }
    }

    pub async fn transcribe(&self, audio: Vec<u8>) -> AppResult<Option<String>> {
        let upload: UploadResponse = self
            .http
            .post(UPLOAD_URL)
            .header("authorization", &self.api_key)
            .body(audio)
            .send()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("assemblyai upload failed: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("invalid upload response: {e}")))?;

        let create: TranscriptResponse = self
            .http
            .post(TRANSCRIPT_URL)
            .header("authorization", &self.api_key)
            .json(&json!({ "audio_url": upload.upload_url, "language_code": "ja" }))
            .send()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("assemblyai transcript request failed: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!("invalid transcript response: {e}")))?;

        for _ in 0..MAX_POLLS {
            tokio::time::sleep(POLL_INTERVAL).await;

            let poll: TranscriptResponse = self
                .http
                .get(format!("{TRANSCRIPT_URL}/{}", create.id))
                .header("authorization", &self.api_key)
                .send()
                .await
                .map_err(|e| AppError::Other(anyhow::anyhow!("assemblyai poll failed: {e}")))?
                .json()
                .await
                .map_err(|e| AppError::Other(anyhow::anyhow!("invalid poll response: {e}")))?;

            match poll.status.as_str() {
                "completed" => return Ok(poll.text),
                "error" => {
                    tracing::warn!("assemblyai transcription error: {:?}", poll.error);
                    return Ok(None);
                }
                _ => continue,
            }
        }

        tracing::warn!("assemblyai transcription timed out");
        Ok(None)
    }
}
