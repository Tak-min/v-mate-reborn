use std::sync::Arc;

use reqwest::Client;
use sqlx::PgPool;

use crate::config::Config;
use crate::core::ai::AIConversationManager;
use crate::core::memory::MemoryManager;
use crate::services::stt::SttService;
use crate::services::tts::TtsService;

/// Shared application state, cloned (cheaply, via Arc/PgPool internal Arc) into every handler.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: PgPool,
    pub http: Client,
    pub ai: AIConversationManager,
    pub tts: TtsService,
    pub stt: SttService,
    pub memory: MemoryManager,
}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        let http = Client::new();
        let ai = AIConversationManager::new(&config, http.clone());
        let tts = TtsService::new(http.clone(), config.elevenlabs_api_key.clone(), config.audio_dir.clone());
        let stt = SttService::new(http.clone(), config.assemblyai_api_key.clone());
        let memory = MemoryManager::new(db.clone());

        Self {
            config: Arc::new(config),
            db,
            http,
            ai,
            tts,
            stt,
            memory,
        }
    }
}
