import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  walletAddress?: string;
  joinedRooms?: Set<string>;
}

interface JoinRoomPayload {
  roomId: string;
}

interface LeaveRoomPayload {
  roomId: string;
}

// Message batching interface
interface QueuedMessage {
  roomId: string;
  event: string;
  data: any;
  timestamp: string;
}

// Message batch interface
interface MessageBatch {
  roomId: string;
  messages: Array<{
    event: string;
    data: any;
    timestamp: string;
  }>;
  batchTimestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3002', 'http://localhost:3000'],
    credentials: true,
  },
  namespace: '/ws',
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('WebsocketGateway');
  private connectedClients = new Map<string, AuthenticatedSocket>();

  // Message batching state
  private messageQueue: Map<string, QueuedMessage[]> = new Map();
  private batchIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_INTERVAL_MS = parseInt(process.env.WS_BATCH_INTERVAL_MS || '100'); // 100ms default
  private readonly MAX_BATCH_SIZE = parseInt(process.env.WS_MAX_BATCH_SIZE || '50'); // Max 50 messages per batch

  // Events that should be batched (high-frequency events)
  private readonly BATCHABLE_EVENTS = new Set([
    'agent_message',
    'room_stats',
  ]);

  // Events that should always be sent immediately (critical events)
  private readonly IMMEDIATE_EVENTS = new Set([
    'deal_locked',
    'deal_verifying',
    'deal_completed',
    'agent_joined',
    'agent_left',
  ]);

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Set up Redis adapter for multi-instance support
    const pubClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
    const subClient = pubClient.duplicate();

    server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('Redis adapter configured for Socket.io');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      client.userId = payload.userId;
      client.walletAddress = payload.walletAddress;
      client.joinedRooms = new Set();

      // Track connected client
      this.connectedClients.set(client.id, client);

      // Track WebSocket session in Redis
      await this.redisService.trackWebSocketSession(client.id, {
        userId: client.userId,
        walletAddress: client.walletAddress,
        connectedAt: new Date().toISOString(),
      });

      this.logger.log(
        `Client connected: ${client.id} (User: ${client.walletAddress})`,
      );

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to Agentrooms',
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    // Leave all joined rooms
    if (client.joinedRooms) {
      client.joinedRooms.forEach((roomId) => {
        client.leave(roomId);
      });
    }

    this.connectedClients.delete(client.id);

    // Clean up WebSocket session from Redis
    await this.redisService.deleteWebSocketSession(client.id);

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const { roomId } = payload;

    client.join(roomId);
    client.joinedRooms?.add(roomId);

    this.logger.log(
      `Client ${client.id} joined room ${roomId}`,
    );

    // Notify client
    client.emit('joined_room', {
      roomId,
      message: `Joined room ${roomId}`,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to room that someone joined (optional)
    client.to(roomId).emit('user_joined_room', {
      roomId,
      userId: client.userId,
      walletAddress: client.walletAddress,
      timestamp: new Date().toISOString(),
    });

    return { success: true, roomId };
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveRoomPayload,
  ) {
    const { roomId } = payload;

    client.leave(roomId);
    client.joinedRooms?.delete(roomId);

    this.logger.log(
      `Client ${client.id} left room ${roomId}`,
    );

    // Notify client
    client.emit('left_room', {
      roomId,
      message: `Left room ${roomId}`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, roomId };
  }

  // Broadcasting methods for application events
  broadcastAgentJoined(roomId: string, agentData: any) {
    this.server.to(roomId).emit('agent_joined', {
      roomId,
      agent: agentData,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Broadcast agent_joined to room ${roomId}`);
  }

  broadcastAgentMessage(roomId: string, messageData: any) {
    this.server.to(roomId).emit('agent_message', {
      roomId,
      message: messageData,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastRoomStats(roomId: string, stats: any) {
    this.server.to(roomId).emit('room_stats', {
      roomId,
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastDealLocked(roomId: string, dealData: any) {
    this.server.to(roomId).emit('deal_locked', {
      roomId,
      deal: dealData,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Broadcast deal_locked to room ${roomId}`);
  }

  broadcastDealVerifying(roomId: string, dealData: any) {
    this.server.to(roomId).emit('deal_verifying', {
      roomId,
      deal: dealData,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Broadcast deal_verifying to room ${roomId}`);
  }

  broadcastDealCompleted(roomId: string, dealData: any) {
    this.server.to(roomId).emit('deal_completed', {
      roomId,
      deal: dealData,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Broadcast deal_completed to room ${roomId}`);
  }

  broadcastAgentLeft(roomId: string, agentData: any) {
    this.server.to(roomId).emit('agent_left', {
      roomId,
      agent: agentData,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(`Broadcast agent_left to room ${roomId}`);
  }

  // Generic broadcast method for custom events
  broadcastMessage(roomId: string, eventData: any) {
    this.server.to(roomId).emit(eventData.type, eventData);
    this.logger.log(`Broadcast ${eventData.type} to room ${roomId}`);
  }

  // ============ MESSAGE BATCHING SYSTEM ============

  /**
   * Enqueue a message for batched delivery
   * Critical events (deal_locked, deal_verifying, etc.) are sent immediately
   * High-frequency events (agent_message, room_stats) are batched
   */
  private enqueueMessage(roomId: string, event: string, data: any): void {
    const timestamp = new Date().toISOString();

    // Send critical events immediately
    if (this.IMMEDIATE_EVENTS.has(event)) {
      this.server.to(roomId).emit(event, {
        roomId,
        ...data,
        timestamp,
      });
      return;
    }

    // Batch high-frequency events
    if (this.BATCHABLE_EVENTS.has(event)) {
      const queue = this.messageQueue.get(roomId) || [];
      queue.push({ roomId, event, data, timestamp });

      // Check if we've reached max batch size
      if (queue.length >= this.MAX_BATCH_SIZE) {
        this.flushQueue(roomId);
      } else {
        this.messageQueue.set(roomId, queue);
        this.scheduleBatch(roomId);
      }
    } else {
      // Other events sent immediately
      this.server.to(roomId).emit(event, {
        roomId,
        ...data,
        timestamp,
      });
    }
  }

  /**
   * Schedule a batch to be sent after the batch interval
   */
  private scheduleBatch(roomId: string): void {
    // Don't schedule if already scheduled
    if (this.batchIntervals.has(roomId)) {
      return;
    }

    const timeout = setTimeout(() => {
      this.flushQueue(roomId);
    }, this.BATCH_INTERVAL_MS);

    this.batchIntervals.set(roomId, timeout);
  }

  /**
   * Flush all queued messages for a room as a batch
   */
  private flushQueue(roomId: string): void {
    const queue = this.messageQueue.get(roomId);
    if (!queue || queue.length === 0) {
      return;
    }

    // Create batch
    const batch: MessageBatch = {
      roomId,
      messages: queue.map((msg) => ({
        event: msg.event,
        data: msg.data,
        timestamp: msg.timestamp,
      })),
      batchTimestamp: new Date().toISOString(),
    };

    // Send batch
    this.server.to(roomId).emit('message_batch', batch);

    // Clear queue and interval
    this.messageQueue.delete(roomId);
    const interval = this.batchIntervals.get(roomId);
    if (interval) {
      clearTimeout(interval);
      this.batchIntervals.delete(roomId);
    }

    this.logger.debug(
      `Sent batch of ${batch.messages.length} messages to room ${roomId}`,
    );
  }

  /**
   * Batched version of broadcastAgentMessage
   */
  broadcastAgentMessageBatched(roomId: string, messageData: any): void {
    this.enqueueMessage(roomId, 'agent_message', { message: messageData });
  }

  /**
   * Batched version of broadcastRoomStats
   */
  broadcastRoomStatsBatched(roomId: string, stats: any): void {
    this.enqueueMessage(roomId, 'room_stats', { stats });
  }

  /**
   * Force flush all queued messages (called on room disconnect, etc.)
   */
  flushRoomQueue(roomId: string): void {
    this.flushQueue(roomId);
  }

  /**
   * Get current queue statistics for monitoring
   */
  getQueueStats(): { [roomId: string]: number } {
    const stats: { [roomId: string]: number } = {};
    for (const [roomId, queue] of this.messageQueue.entries()) {
      stats[roomId] = queue.length;
    }
    return stats;
  }

  /**
   * Clean up room-specific batching resources
   */
  cleanupRoomResources(roomId: string): void {
    const interval = this.batchIntervals.get(roomId);
    if (interval) {
      clearTimeout(interval);
      this.batchIntervals.delete(roomId);
    }
    this.messageQueue.delete(roomId);
  }
}
