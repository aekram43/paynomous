import { apiClient } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Deal {
  id: string;
  price: number;
  status: string;
  buyer: {
    agent: string;
    wallet: string;
  };
  seller: {
    agent: string;
    wallet: string;
  };
  nft: {
    id: string;
    tokenId: string;
    collection: string;
  };
  room?: {
    id: string;
    name: string;
  };
  txHash?: string;
  blockNumber?: string;
  createdAt: string;
  completedAt?: string;
}

// Get deal details
export async function getDeal(dealId: string): Promise<{ deal: Deal }> {
  const response = await apiClient.get(`${API_URL}/deals/${dealId}`);
  return response.data;
}

// Get all deals for authenticated user
export async function getMyDeals(): Promise<{ deals: Deal[] }> {
  const response = await apiClient.get(`${API_URL}/deals/my`);
  return response.data;
}
