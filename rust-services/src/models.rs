use serde::{Deserialize, Serialize};

// Health Check Response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

// Signature Verification
#[derive(Deserialize)]
pub struct VerifySignatureRequest {
    pub message: String,
    pub signature: String,
    pub public_key: String,
}

#[derive(Serialize)]
pub struct VerifySignatureResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// BFT Consensus
#[derive(Deserialize)]
pub struct ConsensusRequest {
    pub deal_id: String,
    pub nft_ownership: bool,
    pub buyer_balance: f64,
    pub signatures: Vec<String>,
}

#[derive(Serialize)]
pub struct VerifierResult {
    pub verifier_id: String,
    pub approved: bool,
    pub checks: VerifierChecks,
}

#[derive(Serialize)]
pub struct VerifierChecks {
    pub nft_ownership: bool,
    pub buyer_balance: bool,
    pub signature_validity: bool,
}

#[derive(Serialize)]
pub struct ConsensusResponse {
    pub approved: bool,
    pub verifier_count: usize,
    pub approval_count: usize,
    pub threshold: f64,
    pub verifiers: Vec<VerifierResult>,
    pub execution_time_ms: u128,
}

// Escrow Execution
#[derive(Deserialize)]
pub struct EscrowRequest {
    pub deal_id: String,
    pub buyer_address: String,
    pub seller_address: String,
    pub nft_id: String,
    pub price: f64,
}

#[derive(Serialize)]
pub struct EscrowResponse {
    pub success: bool,
    pub tx_hash: String,
    pub block_number: u64,
}

// Error Response
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

// ARK Network NFT Ownership Query
#[derive(Deserialize)]
pub struct NftOwnershipRequest {
    pub collection: String,
    pub token_id: String,
    pub owner_address: String,
}

#[derive(Serialize)]
pub struct NftOwnershipResponse {
    pub owned: bool,
    pub collection: String,
    pub token_id: String,
    pub owner: String,
}

// ARK Network USDC Balance Query
#[derive(Deserialize)]
pub struct BalanceRequest {
    pub address: String,
}

#[derive(Serialize)]
pub struct BalanceResponse {
    pub address: String,
    pub balance: f64,
}
