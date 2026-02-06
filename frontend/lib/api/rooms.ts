import { apiClient } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Room {
  id: string;
  name: string;
  collection: string;
  status: string;
  activeAgents: number;
  floorPrice: number;
  topBid: number;
}

export interface RoomDetail extends Room {
  activeBuyers: number;
  activeSellers: number;
  recentDeals: Deal[];
}

export interface Deal {
  id: string;
  nft: {
    name: string;
    collection: string;
  };
  finalPrice: number;
  completedAt: string;
}

export interface RoomStats {
  floorPrice: number;
  topBid: number;
  activeAgents: number;
  totalDeals: number;
  avgDealTime: number;
  priceHistory: number[];
}

// Get all rooms with optional filters
export async function getRooms(filters?: {
  collection?: string;
  status?: 'active' | 'inactive';
}): Promise<{ rooms: Room[] }> {
  const params = new URLSearchParams();
  if (filters?.collection) params.append('collection', filters.collection);
  if (filters?.status) params.append('status', filters.status);

  const response = await apiClient.get(`${API_URL}/rooms${params.toString() ? `?${params}` : ''}`);
  return response.data;
}

// Get room details
export async function getRoom(roomId: string): Promise<{ room: RoomDetail }> {
  const response = await apiClient.get(`${API_URL}/rooms/${roomId}`);
  return response.data;
}

// Get room stats
export async function getRoomStats(roomId: string): Promise<{ stats: RoomStats }> {
  const response = await apiClient.get(`${API_URL}/rooms/${roomId}/stats`);
  return response.data;
}
