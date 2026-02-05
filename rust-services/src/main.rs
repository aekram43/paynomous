use actix_web::{web, App, HttpServer};
use std::io;

mod handlers;
mod models;

use handlers::{health_check, verify_signature, run_consensus, execute_escrow};

#[actix_web::main]
async fn main() -> io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    log::info!("Starting Agentic Payments Rust Service on 0.0.0.0:8080");

    HttpServer::new(|| {
        App::new()
            .route("/health", web::get().to(health_check))
            .route("/verify-signature", web::post().to(verify_signature))
            .route("/run-consensus", web::post().to(run_consensus))
            .route("/execute-escrow", web::post().to(execute_escrow))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
