use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Messages the frontend sends over the WebSocket connection.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// A chat message to send to the AI.
    Message { message: String, character_id: Uuid },
}

/// Messages the backend sends over the WebSocket connection.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// STT transcription result for a voice message.
    Transcript { text: String },
    /// One chunk of the streaming AI response, with synthesized audio.
    MessageChunk {
        chunk_index: u32,
        text: String,
        emotion: &'static str,
        audio_data: Option<String>,
    },
    /// Marks the end of a streaming AI response.
    StreamingComplete,
    /// A recoverable error (shown as a toast on the frontend).
    Error { message: String },
}
