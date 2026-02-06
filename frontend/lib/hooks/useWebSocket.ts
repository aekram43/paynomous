'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

export interface RoomStatsUpdate {
  floorPrice: number;
  topBid: number;
  activeAgents: number;
  activeBuyers: number;
  activeSellers: number;
}

export interface AgentJoinedData {
  agent: {
    id: string;
    name: string;
    avatar: string;
    role: 'buyer' | 'seller';
  };
}

export interface AgentMessageData {
  agent: {
    id: string;
    name: string;
    avatar: string;
  };
  message: string;
  timestamp: string;
}

export interface DealLockedData {
  dealId: string;
  buyerAgent: { id: string; name: string };
  sellerAgent: { id: string; name: string };
  nft: { name: string; collection: string };
  price: number;
}

export interface DealCompletedData {
  dealId: string;
  txHash: string;
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
  nft: { name: string; collection: string };
  price: number;
}

export interface AgentLeftData {
  agentId: string;
  reason: string;
}

// Message batch interface for handling batched WebSocket messages
export interface MessageBatch {
  roomId: string;
  messages: Array<{
    event: string;
    data: any;
    timestamp: string;
  }>;
  batchTimestamp: string;
}

interface WebSocketCallbacks {
  onRoomStats?: (data: RoomStatsUpdate) => void;
  onAgentJoined?: (data: AgentJoinedData) => void;
  onAgentMessage?: (data: AgentMessageData) => void;
  onDealLocked?: (data: DealLockedData) => void;
  onDealVerifying?: (data: { dealId: string; progress: number; stage: string }) => void;
  onDealCompleted?: (data: DealCompletedData) => void;
  onAgentLeft?: (data: AgentLeftData) => void;
  onError?: (data: { message: string }) => void;
  onMessageBatch?: (batch: MessageBatch) => void; // New callback for message batches
}

export function useWebSocket(roomId: string | null, callbacks: WebSocketCallbacks) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Get auth token from localStorage
    const authStorage = typeof window !== 'undefined' ? localStorage.getItem('agentrooms-auth') : null;
    const token = authStorage ? JSON.parse(authStorage).state.accessToken : null;

    if (!token) return;

    // Create socket connection
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join room
      socket.emit('join_room', { roomId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Room stats updates
    socket.on('room_stats', (data: RoomStatsUpdate) => {
      callbacks.onRoomStats?.(data);
    });

    // Agent joined
    socket.on('agent_joined', (data: AgentJoinedData) => {
      callbacks.onAgentJoined?.(data);
    });

    // Agent message
    socket.on('agent_message', (data: AgentMessageData) => {
      callbacks.onAgentMessage?.(data);
    });

    // Deal locked
    socket.on('deal_locked', (data: DealLockedData) => {
      callbacks.onDealLocked?.(data);
    });

    // Deal verifying
    socket.on('deal_verifying', (data: { dealId: string; progress: number; stage: string }) => {
      callbacks.onDealVerifying?.(data);
    });

    // Deal completed
    socket.on('deal_completed', (data: DealCompletedData) => {
      callbacks.onDealCompleted?.(data);
    });

    // Agent left
    socket.on('agent_left', (data: AgentLeftData) => {
      callbacks.onAgentLeft?.(data);
    });

    // Error
    socket.on('error', (data: { message: string }) => {
      callbacks.onError?.(data);
    });

    // Message batch - handle batched messages for performance
    socket.on('message_batch', (batch: MessageBatch) => {
      // Call the batch callback if provided
      callbacks.onMessageBatch?.(batch);

      // Also process individual messages in the batch
      for (const msg of batch.messages) {
        switch (msg.event) {
          case 'agent_message':
            callbacks.onAgentMessage?.(msg.data);
            break;
          case 'room_stats':
            callbacks.onRoomStats?.(msg.data);
            break;
          case 'agent_joined':
            callbacks.onAgentJoined?.(msg.data);
            break;
          case 'deal_locked':
            callbacks.onDealLocked?.(msg.data);
            break;
          case 'deal_verifying':
            callbacks.onDealVerifying?.(msg.data);
            break;
          case 'deal_completed':
            callbacks.onDealCompleted?.(msg.data);
            break;
          case 'agent_left':
            callbacks.onAgentLeft?.(msg.data);
            break;
        }
      }
    });

    return () => {
      if (roomId) {
        socket.emit('leave_room', { roomId });
      }
      socket.disconnect();
    };
  }, [roomId]);

  const connectionStatus = isConnected ? 'connected' : 'disconnected';

  return { isConnected, connectionStatus };
}
