mod handler;
mod protocol;

use axum::routing::get;
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(handler::upgrade))
}
