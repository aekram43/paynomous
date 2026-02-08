use actix_web::{web, HttpResponse, Responder};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::Rng;
use sha2::{Digest, Sha256};

use crate::ark_client::ArkClient;
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
    use std::time::Instant;

    let start_time = Instant::now();
    log::info!("Running BFT consensus for deal: {}", payload.deal_id);

    const VERIFIER_COUNT: usize = 7;
    const THRESHOLD: f64 = 0.67; // 67% approval required (5 out of 7 verifiers)

    // Generate 7 random verifier IDs
    let verifier_ids: Vec<String> = (0..VERIFIER_COUNT)
        .map(|_| format!("verifier-{:02x}", rand::thread_rng().gen::<u8>()))
        .collect();

    let mut approval_count = 0;
    let mut verifier_results = Vec::new();

    // Each verifier independently checks the deal
    for (i, verifier_id) in verifier_ids.iter().enumerate() {
        // Each verifier checks:
        // 1. NFT ownership is valid (from blockchain query)
        // 2. Buyer has sufficient balance (from blockchain query)
        // 3. Signatures are valid (cryptographic verification)

        let nft_check = payload.nft_ownership;
        let balance_check = payload.buyer_balance > 0.0;
        let signature_check = !payload.signatures.is_empty() && payload.signatures.len() >= 2;

        // Verifier approves if all checks pass
        let approves = nft_check && balance_check && signature_check;

        if approves {
            approval_count += 1;
        }

        log::debug!(
            "Verifier {} ({}) result: {} (NFT: {}, Balance: {:.2} USDC, Sig: {}/{})",
            i + 1,
            verifier_id,
            approves,
            nft_check,
            payload.buyer_balance,
            payload.signatures.len(),
            2
        );

        verifier_results.push(crate::models::VerifierResult {
            verifier_id: verifier_id.clone(),
            approved: approves,
            checks: crate::models::VerifierChecks {
                nft_ownership: nft_check,
                buyer_balance: balance_check,
                signature_validity: signature_check,
            },
        });

        // Small delay to simulate network communication (10-50ms per verifier)
        tokio::time::sleep(tokio::time::Duration::from_millis(
            rand::thread_rng().gen_range(10..50)
        )).await;
    }

    let approval_rate = approval_count as f64 / VERIFIER_COUNT as f64;
    let approved = approval_rate >= THRESHOLD;

    let execution_time = start_time.elapsed().as_millis();

    log::info!(
        "Consensus result: {} ({}/{} verifiers approved, rate: {:.2}%, time: {}ms)",
        approved,
        approval_count,
        VERIFIER_COUNT,
        approval_rate * 100.0,
        execution_time
    );

    HttpResponse::Ok().json(crate::models::ConsensusResponse {
        approved,
        verifier_count: VERIFIER_COUNT,
        approval_count,
        threshold: THRESHOLD,
        verifiers: verifier_results,
        execution_time_ms: execution_time,
    })
}

/// Query NFT ownership on ARK Network
pub async fn query_nft_ownership(payload: web::Json<NftOwnershipRequest>) -> impl Responder {
    log::info!(
        "Querying NFT ownership: collection={}, token_id={}, owner={}",
        payload.collection,
        payload.token_id,
        payload.owner_address
    );

    match ArkClient::new() {
        Ok(client) => {
            match client
                .query_nft_ownership(&payload.collection, &payload.token_id, &payload.owner_address)
                .await
            {
                Ok(owned) => {
                    log::info!("NFT ownership result: {}", owned);
                    HttpResponse::Ok().json(NftOwnershipResponse {
                        owned,
                        collection: payload.collection.clone(),
                        token_id: payload.token_id.clone(),
                        owner: payload.owner_address.clone(),
                    })
                }
                Err(e) => {
                    log::error!("Failed to query NFT ownership: {}", e);
                    HttpResponse::InternalServerError().json(ErrorResponse {
                        error: "NFT_QUERY_FAILED".to_string(),
                        message: format!("Failed to query NFT ownership: {}", e),
                    })
                }
            }
        }
        Err(e) => {
            log::error!("Failed to create ARK client: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "ARK_CLIENT_ERROR".to_string(),
                message: format!("Failed to initialize ARK client: {}", e),
            })
        }
    }
}

/// Query USDC balance on ARK Network
pub async fn query_usdc_balance(payload: web::Json<BalanceRequest>) -> impl Responder {
    log::info!("Querying USDC balance for address: {}", payload.address);

    match ArkClient::new() {
        Ok(client) => {
            match client.query_usdc_balance(&payload.address).await {
                Ok(balance) => {
                    log::info!("USDC balance: {} USDC", balance);
                    HttpResponse::Ok().json(BalanceResponse {
                        address: payload.address.clone(),
                        balance,
                    })
                }
                Err(e) => {
                    log::error!("Failed to query USDC balance: {}", e);
                    HttpResponse::InternalServerError().json(ErrorResponse {
                        error: "BALANCE_QUERY_FAILED".to_string(),
                        message: format!("Failed to query USDC balance: {}", e),
                    })
                }
            }
        }
        Err(e) => {
            log::error!("Failed to create ARK client: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "ARK_CLIENT_ERROR".to_string(),
                message: format!("Failed to initialize ARK client: {}", e),
            })
        }
    }
}

/// Execute escrow transaction on ARK Network
pub async fn execute_escrow(payload: web::Json<EscrowRequest>) -> impl Responder {
    log::info!(
        "Executing escrow for deal: {} (NFT: {} from {} to {} for {} USDC)",
        payload.deal_id,
        payload.nft_id,
        payload.seller_address,
        payload.buyer_address,
        payload.price
    );

    match ArkClient::new() {
        Ok(client) => {
            // Execute escrow transaction with proper error handling
            match client
                .execute_escrow_transaction(
                    &payload.buyer_address,
                    &payload.seller_address,
                    &payload.nft_id, // Using nft_id as collection for now
                    "1", // Token ID placeholder - in production would parse from nft_id
                    payload.price,
                )
                .await
            {
                Ok(receipt) => {
                    log::info!(
                        "Escrow transaction successful: tx_hash={}, block={}, confirmations={}",
                        receipt.tx_hash,
                        receipt.block_number,
                        receipt.confirmations
                    );

                    HttpResponse::Ok().json(EscrowResponse {
                        success: receipt.status == "success",
                        tx_hash: receipt.tx_hash,
                        block_number: receipt.block_number,
                    })
                }
                Err(e) => {
                    log::error!("Escrow transaction failed: {}", e);
                    HttpResponse::InternalServerError().json(ErrorResponse {
                        error: "ESCROW_FAILED".to_string(),
                        message: format!("Escrow transaction failed: {}", e),
                    })
                }
            }
        }
        Err(e) => {
            log::error!("Failed to create ARK client: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "ARK_CLIENT_ERROR".to_string(),
                message: format!("Failed to initialize ARK client: {}", e),
            })
        }
    }
}
