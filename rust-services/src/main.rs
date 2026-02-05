use actix_web::{web, App, HttpServer};
use std::io;

mod ark_client;
mod handlers;
mod models;

use handlers::{
    execute_escrow, health_check, query_nft_ownership, query_usdc_balance, run_consensus,
    verify_signature,
};

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
            .route("/query-nft-ownership", web::post().to(query_nft_ownership))
            .route("/query-usdc-balance", web::post().to(query_usdc_balance))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
