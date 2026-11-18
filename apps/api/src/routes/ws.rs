use axum::{
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::Response,
};
use axum_extra::{TypedHeader, headers::{Authorization, authorization::Bearer}};

use crate::{app::AppState, authentication::jwt::verify_access_token};

pub fn router() -> axum::Router<AppState> {
    axum::Router::new().route("/ws", axum::routing::get(handler))
}

pub async fn handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    TypedHeader(Authorization(bearer)): TypedHeader<Authorization<Bearer>>,
) -> Response {
    match verify_access_token(bearer.token(), &state.jwt_secret) {
        Ok(_claims) => ws.on_upgrade(move |socket| serve(socket, state)),
        Err(_) => {
            // Reject unauthenticated upgrade by not upgrading — return 401 body.
            axum::response::IntoResponse::into_response((
                axum::http::StatusCode::UNAUTHORIZED,
                "Invalid or missing token",
            ))
        }
    }
}

async fn serve(mut socket: WebSocket, state: AppState) {
    let mut rx = state.ws_tx.subscribe();
    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Ok(ev) => {
                        if let Ok(json) = serde_json::to_string(&ev) {
                            if socket.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}
