import { apiClient } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Nft {
  id: string;
  tokenId: string;
  name: string;
  collection: string;
  collectionAddress: string;
  ownerAddress: string;
  imageUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyOwnershipRequest {
  nftId: string;
  walletAddress: string;
}

export interface VerifyOwnershipResponse {
  owns: boolean;
  nft?: Nft;
}

// Get all NFTs with optional collection filter
export async function getNfts(collectionName?: string): Promise<{ nfts: Nft[] }> {
  const params = collectionName ? `?collectionName=${encodeURIComponent(collectionName)}` : '';
  const response = await apiClient.get(`${API_URL}/nfts${params}`);
  return response.data;
}

// Verify NFT ownership
export async function verifyOwnership(data: VerifyOwnershipRequest): Promise<VerifyOwnershipResponse> {
  const response = await apiClient.post(`${API_URL}/nfts/verify-ownership`, data);
  return response.data;
}
