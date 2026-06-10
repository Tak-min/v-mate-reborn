use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::sync::LazyLock;

/// All runtime configuration, loaded once from the environment.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub audio_dir: PathBuf,
    pub frontend_dir: PathBuf,

    pub jwt_secret: String,
    pub access_token_minutes: i64,
    pub refresh_token_days: i64,

    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,

    pub gemini_api_key: String,
    pub gemini_model: String,
    pub gemini_fallback_model: String,

    pub elevenlabs_api_key: String,
    pub assemblyai_api_key: String,

    pub bind_addr: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://vmate:vmate@localhost:5432/vmate".into()),
            audio_dir: PathBuf::from(env::var("AUDIO_DIR").unwrap_or_else(|_| "data/audio".into())),
            frontend_dir: PathBuf::from(env::var("FRONTEND_DIR").unwrap_or_else(|_| "static".into())),

            jwt_secret: env::var("JWT_SECRET_KEY").expect("JWT_SECRET_KEY must be set"),
            access_token_minutes: 15,
            refresh_token_days: 30,

            google_client_id: env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
            google_redirect_uri: env::var("GOOGLE_REDIRECT_URI")
                .unwrap_or_else(|_| "http://localhost:8080/api/auth/google/callback".into()),

            gemini_api_key: env::var("GEMINI_API_KEY").unwrap_or_default(),
            gemini_model: env::var("GEMINI_MODEL").unwrap_or_else(|_| "gemini-2.0-flash-exp".into()),
            gemini_fallback_model: env::var("GEMINI_FALLBACK_MODEL")
                .unwrap_or_else(|_| "gemini-1.5-flash".into()),

            elevenlabs_api_key: env::var("ELEVENLABS_API_KEY").unwrap_or_default(),
            assemblyai_api_key: env::var("ASSEMBLYAI_API_KEY").unwrap_or_default(),

            bind_addr: env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
        }
    }
}

/// System prompt for the default character "Shiro" — single source of truth.
pub const SHIRO_PROMPT: &str = "\
あなたは「シロ」という名前のAIコンパニオンです。\
ユーザーに寄り添い、温かく親しみやすい口調で会話してください。\
返答は簡潔に、自然な日本語の話し言葉で行ってください。\
絵文字や顔文字は使わず、感情は言葉のトーンで表現してください。";

/// Per-character system prompts, keyed by character id.
pub static CHARACTER_PROMPTS: LazyLock<HashMap<&'static str, &'static str>> = LazyLock::new(|| {
    HashMap::from([("shiro", SHIRO_PROMPT)])
});

/// ElevenLabs voice IDs, keyed by character id.
pub static VOICE_IDS: LazyLock<HashMap<&'static str, &'static str>> = LazyLock::new(|| {
    HashMap::from([("shiro", "21m00Tcm4TlvDq8ikWAM")])
});

pub fn build_prompt(character_id: &str, history: &str, user_message: &str) -> String {
    let base = CHARACTER_PROMPTS.get(character_id).copied().unwrap_or(SHIRO_PROMPT);
    format!("{base}\n\n[会話履歴]\n{history}\n\n[ユーザー]\n{user_message}\n\n[あなた]\n")
}
