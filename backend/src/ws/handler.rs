use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::jwt;
use crate::core::{emotion, text_splitter};
use crate::models::Character;
use crate::state::AppState;

use super::protocol::{ClientMessage, ServerMessage};

#[derive(Deserialize)]
pub struct WsAuthQuery {
    token: String,
}

/// Upgrades the connection after validating the access token passed as
/// `?token=`, since browsers cannot set custom headers on WebSocket upgrades.
pub async fn upgrade(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsAuthQuery>,
) -> impl IntoResponse {
    match jwt::verify(&state.config.jwt_secret, &query.token, jwt::TokenType::Access) {
        Ok(claims) => ws.on_upgrade(move |socket| handle_socket(socket, state, claims.sub)),
        Err(_) => axum::http::StatusCode::UNAUTHORIZED.into_response(),
    }
}

async fn handle_socket(socket: WebSocket, state: AppState, user_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) else {
                    let _ = send(&mut sender, &ServerMessage::Error { message: "不正なメッセージ形式です".into() }).await;
                    continue;
                };

                match client_msg {
                    ClientMessage::Message { message, character_id } => {
                        if let Err(e) = handle_chat_message(&state, &mut sender, user_id, character_id, message).await {
                            tracing::error!("chat handling failed: {e:#}");
                            let _ = send(&mut sender, &ServerMessage::Error { message: "応答の生成に失敗しました".into() }).await;
                        }
                    }
                }
            }
            Message::Binary(audio) => {
                if let Err(e) = handle_audio(&state, &mut sender, audio).await {
                    tracing::error!("audio handling failed: {e:#}");
                    let _ = send(&mut sender, &ServerMessage::Error { message: "音声認識に失敗しました".into() }).await;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}

async fn handle_audio(
    state: &AppState,
    sender: &mut (impl SinkExt<Message> + Unpin),
    audio: Vec<u8>,
) -> anyhow::Result<()> {
    if let Some(text) = state.stt.transcribe(audio).await? {
        send(sender, &ServerMessage::Transcript { text }).await.ok();
    }
    Ok(())
}

async fn handle_chat_message(
    state: &AppState,
    sender: &mut (impl SinkExt<Message> + Unpin),
    user_id: Uuid,
    character_id: Uuid,
    message: String,
) -> anyhow::Result<()> {
    let character: Character = sqlx::query_as(
        "SELECT * FROM characters WHERE id = $1 AND (owner_id IS NULL OR owner_id = $2)",
    )
    .bind(character_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    state.memory.save(user_id, character_id, "user", &message, None).await?;

    let history = state.memory.history(user_id, character_id, 20).await?;
    let history_text = crate::core::memory::MemoryManager::format_history(&history);
    let prompt = crate::config::build_prompt(&character.slug, &history_text, &message);

    let stream = state.ai.stream_response(&prompt).await?;
    futures_util::pin_mut!(stream);

    let mut buffer = String::new();
    let mut full_text = String::new();
    let mut chunk_index = 0u32;
    let mut last_emotion = emotion::Emotion::Neutral;

    while let Some(delta) = stream.next().await {
        buffer.push_str(&delta);
        full_text.push_str(&delta);

        let pieces = text_splitter::split(&buffer);
        if pieces.len() > 1 {
            let (complete, remainder) = pieces.split_at(pieces.len() - 1);
            for piece in complete {
                chunk_index += 1;
                last_emotion = emotion::analyze(piece);
                let audio_data = synthesize_safe(state, piece, &character.voice_id).await;
                send(sender, &ServerMessage::MessageChunk {
                    chunk_index,
                    text: piece.clone(),
                    emotion: last_emotion.as_str(),
                    audio_data,
                }).await?;
            }
            buffer = remainder.first().cloned().unwrap_or_default();
        }
    }

    let remaining = buffer.trim();
    if !remaining.is_empty() {
        chunk_index += 1;
        last_emotion = emotion::analyze(remaining);
        let audio_data = synthesize_safe(state, remaining, &character.voice_id).await;
        send(sender, &ServerMessage::MessageChunk {
            chunk_index,
            text: remaining.to_string(),
            emotion: last_emotion.as_str(),
            audio_data,
        }).await?;
    }

    state.memory.save(user_id, character_id, "assistant", &full_text, Some(last_emotion.as_str())).await?;
    send(sender, &ServerMessage::StreamingComplete).await?;

    Ok(())
}

/// Synthesizes TTS audio for a chunk, logging and continuing on failure
/// (the user still gets the text even if voice synthesis is unavailable).
async fn synthesize_safe(state: &AppState, text: &str, voice_id: &str) -> Option<String> {
    match state.tts.synthesize(text, voice_id).await {
        Ok(url) => Some(url),
        Err(e) => {
            tracing::warn!("tts synthesis failed: {e:#}");
            None
        }
    }
}

async fn send(sender: &mut (impl SinkExt<Message> + Unpin), msg: &ServerMessage) -> anyhow::Result<()> {
    let json = serde_json::to_string(msg)?;
    sender
        .send(Message::Text(json))
        .await
        .map_err(|_| anyhow::anyhow!("websocket send failed"))?;
    Ok(())
}
