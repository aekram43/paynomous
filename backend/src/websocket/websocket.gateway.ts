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

@WebSocketGateway({
  cors: {
    origin: '*',
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

  constructor(private jwtService: JwtService) {}

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

  handleDisconnect(client: AuthenticatedSocket) {
    // Leave all joined rooms
    if (client.joinedRooms) {
      client.joinedRooms.forEach((roomId) => {
        client.leave(roomId);
      });
    }

    this.connectedClients.delete(client.id);
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
}
