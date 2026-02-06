import { apiClient } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Agent {
  id: string;
  name: string;
  avatar: string | null;
  role: 'buyer' | 'seller';
  status: string;
  roomId: string;
  room: {
    id: string;
    name: string;
    collection: string;
  };
  userId: string;
  nftId: string | null;
  nft: {
    id: string;
    name: string;
    collection: string;
    imageUrl: string | null;
  } | null;
  strategy: string;
  communicationStyle: string;
  minPrice: number;
  maxPrice: number;
  startingPrice: number;
  currentPrice: number | null;
  messagesSent: number;
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpawnAgentRequest {
  roomId: string;
  name: string;
  avatar?: string;
  role: 'buyer' | 'seller';
  nftId?: string;
  minPrice: number;
  maxPrice: number;
  startingPrice: number;
  strategy: 'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper';
  personality: 'formal' | 'casual' | 'professional' | 'aggressive';
}

export interface SpawnAgentResponse {
  agent: Agent;
}

// Spawn a new agent
export async function spawnAgent(data: SpawnAgentRequest): Promise<SpawnAgentResponse> {
  const response = await apiClient.post(`${API_URL}/agents/spawn`, data);
  return response.data;
}

// Get agent details
export async function getAgent(agentId: string): Promise<{ agent: Agent }> {
  const response = await apiClient.get(`${API_URL}/agents/${agentId}`);
  return response.data;
}

// Delete an agent
export async function deleteAgent(agentId: string): Promise<{ message: string }> {
  const response = await apiClient.delete(`${API_URL}/agents/${agentId}`);
  return response.data;
}
