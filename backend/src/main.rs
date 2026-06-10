mod api;
mod auth;
mod config;
mod core;
mod db;
mod error;
mod models;
mod services;
mod state;
mod ws;

use std::net::SocketAddr;

use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive("vmate_backend=info".parse()?))
        .init();

    let config = Config::from_env();
    let pool = db::connect(&config.database_url).await?;
    tokio::fs::create_dir_all(&config.audio_dir).await.ok();

    let state = AppState::new(config.clone(), pool);

    let static_dir = ServeDir::new(&state.config.frontend_dir)
        .fallback(ServeFile::new(state.config.frontend_dir.join("index.html")));
    let audio_dir = ServeDir::new(&state.config.audio_dir);

    let app = Router::new()
        .nest("/api/auth", api::auth::router())
        .nest("/api/characters", api::characters::router())
        .nest("/api", api::misc::router())
        .nest("/ws", ws::router())
        .nest_service("/audio", audio_dir)
        .fallback_service(static_dir)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = config.bind_addr.parse()?;
    tracing::info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
