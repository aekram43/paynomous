use actix_web::{web, HttpResponse, Responder};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::Rng;
use sha2::{Digest, Sha256};

use crate::models::*;

/// Health check endpoint
pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        service: "agentic-payments".to_string(),
        version: "0.1.0".to_string(),
    })
}

/// Verify Ed25519 signature
pub async fn verify_signature(payload: web::Json<VerifySignatureRequest>) -> impl Responder {
    log::info!("Verifying signature for message: {}", payload.message);

    // Decode public key from hex
    let public_key_bytes = match hex::decode(&payload.public_key) {
        Ok(bytes) => bytes,
        Err(e) => {
            log::error!("Invalid public key hex: {}", e);
            return HttpResponse::BadRequest().json(VerifySignatureResponse {
                valid: false,
                error: Some(format!("Invalid public key hex: {}", e)),
            });
        }
    };

    // Ensure public key is 32 bytes
    if public_key_bytes.len() != 32 {
        log::error!("Public key must be 32 bytes, got {}", public_key_bytes.len());
        return HttpResponse::BadRequest().json(VerifySignatureResponse {
            valid: false,
            error: Some(format!("Public key must be 32 bytes, got {}", public_key_bytes.len())),
        });
    }

    // Create verifying key
    let verifying_key = match VerifyingKey::from_bytes(
        &public_key_bytes.as_slice().try_into().unwrap()
    ) {
        Ok(key) => key,
        Err(e) => {
            log::error!("Invalid public key: {}", e);
            return HttpResponse::BadRequest().json(VerifySignatureResponse {
                valid: false,
                error: Some(format!("Invalid public key: {}", e)),
            });
        }
    };

    // Decode signature from hex
    let signature_bytes = match hex::decode(&payload.signature) {
        Ok(bytes) => bytes,
        Err(e) => {
            log::error!("Invalid signature hex: {}", e);
            return HttpResponse::BadRequest().json(VerifySignatureResponse {
                valid: false,
                error: Some(format!("Invalid signature hex: {}", e)),
            });
        }
    };

    // Ensure signature is 64 bytes
    if signature_bytes.len() != 64 {
        log::error!("Signature must be 64 bytes, got {}", signature_bytes.len());
        return HttpResponse::BadRequest().json(VerifySignatureResponse {
            valid: false,
            error: Some(format!("Signature must be 64 bytes, got {}", signature_bytes.len())),
        });
    }

    // Create signature
    let signature = Signature::from_bytes(
        &signature_bytes.as_slice().try_into().unwrap()
    );

    // Verify signature
    let valid = verifying_key.verify(payload.message.as_bytes(), &signature).is_ok();

    log::info!("Signature verification result: {}", valid);

    HttpResponse::Ok().json(VerifySignatureResponse {
        valid,
        error: None,
    })
}

/// Run BFT consensus with 7 mock verifiers
pub async fn run_consensus(payload: web::Json<ConsensusRequest>) -> impl Responder {
    log::info!("Running BFT consensus for deal: {}", payload.deal_id);

    const VERIFIER_COUNT: usize = 7;
    const THRESHOLD: f64 = 0.67; // 67% approval required

    let mut approval_count = 0;

    // Simulate 7 verifiers checking the deal
    for i in 0..VERIFIER_COUNT {
        // Each verifier checks:
        // 1. NFT ownership is valid
        // 2. Buyer has sufficient balance
        // 3. Signatures are valid

        let nft_check = payload.nft_ownership;
        let balance_check = payload.buyer_balance > 0.0; // Check buyer has sufficient balance
        let signature_check = !payload.signatures.is_empty();

        // Verifier approves if all checks pass
        let approves = nft_check && balance_check && signature_check;

        if approves {
            approval_count += 1;
        }

        log::debug!(
            "Verifier {} result: {} (NFT: {}, Balance: {}, Sig: {})",
            i + 1,
            approves,
            nft_check,
            balance_check,
            signature_check
        );
    }

    let approval_rate = approval_count as f64 / VERIFIER_COUNT as f64;
    let approved = approval_rate >= THRESHOLD;

    log::info!(
        "Consensus result: {} ({}/{} verifiers approved, rate: {:.2}%)",
        approved,
        approval_count,
        VERIFIER_COUNT,
        approval_rate * 100.0
    );

    HttpResponse::Ok().json(ConsensusResponse {
        approved,
        verifier_count: VERIFIER_COUNT,
        approval_count,
        threshold: THRESHOLD,
    })
}

/// Execute escrow transaction (mock blockchain)
pub async fn execute_escrow(payload: web::Json<EscrowRequest>) -> impl Responder {
    log::info!(
        "Executing escrow for deal: {} (NFT: {} from {} to {} for {} USDC)",
        payload.deal_id,
        payload.nft_id,
        payload.seller_address,
        payload.buyer_address,
        payload.price
    );

    // Simulate blockchain transaction
    // In production, this would:
    // 1. Connect to ARK Network
    // 2. Prepare escrow transaction
    // 3. Sign with private key
    // 4. Submit to blockchain
    // 5. Wait for confirmation

    // Generate mock transaction hash (SHA256 of deal details)
    let tx_data = format!(
        "{}:{}:{}:{}:{}",
        payload.deal_id,
        payload.buyer_address,
        payload.seller_address,
        payload.nft_id,
        payload.price
    );

    let mut hasher = Sha256::new();
    hasher.update(tx_data.as_bytes());
    let hash_result = hasher.finalize();
    let tx_hash = format!("0x{}", hex::encode(hash_result));

    // Generate mock block number
    let mut rng = rand::thread_rng();
    let block_number: u64 = rng.gen_range(1000000..2000000);

    log::info!(
        "Escrow transaction successful: tx_hash={}, block={}",
        tx_hash,
        block_number
    );

    HttpResponse::Ok().json(EscrowResponse {
        success: true,
        tx_hash,
        block_number,
    })
}
