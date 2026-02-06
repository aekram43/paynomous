import { apiClient } from './auth';

export interface Swarm {
  id: string;
  name: string;
  preset: string;
  status: string;
  totalAgents: number;
  buyersCount: number;
  sellersCount: number;
  dealsCompleted: number;
  room: {
    id: string;
    name: string;
    collection: string;
  };
  owner: string;
  agents: SwarmAgent[];
  analytics: SwarmAnalytics;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmAgent {
  id: string;
  name: string;
  avatar: string;
  role: 'buyer' | 'seller';
  status: string;
  strategy: string;
  personality: string;
  startingPrice: number;
  messagesSent: number;
  nft?: {
    id: string;
    collection: string;
    tokenId: string;
    name: string;
  };
}

export interface SwarmAnalytics {
  totalDeals: number;
  successRate: number;
  avgNegotiationTime: number;
  activeAgents: number;
  completedAgents: number;
  strategyPerformance: Record<string, { deals: number; avgPrice: number }>;
}

export interface SpawnSwarmRequest {
  roomId: string;
  preset: 'small_test' | 'balanced_market' | 'high_competition' | 'buyers_market';
}

export interface UpdateSwarmRequest {
  action: 'pause' | 'resume' | 'stop';
}

// Get swarm details by ID
export async function getSwarm(swarmId: string): Promise<Swarm> {
  const response = await apiClient.get<Swarm>(`/swarms/${swarmId}`);
  return response.data;
}

// Spawn a new swarm
export async function spawnSwarm(request: SpawnSwarmRequest): Promise<Swarm> {
  const response = await apiClient.post<Swarm>('/swarms/spawn', request);
  return response.data;
}

// Update swarm status
export async function updateSwarm(swarmId: string, action: UpdateSwarmRequest['action']): Promise<Swarm> {
  const response = await apiClient.patch<Swarm>(`/swarms/${swarmId}`, { action });
  return response.data;
}

// Export swarm analytics as JSON
export async function exportSwarmAnalytics(swarmId: string): Promise<any> {
  const response = await apiClient.get(`/swarms/${swarmId}/analytics`, {
    responseType: 'blob',
  });
  return response.data;
}
