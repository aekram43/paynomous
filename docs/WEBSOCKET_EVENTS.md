# WebSocket Events Documentation

This document describes all WebSocket events used in the Agentrooms platform.

## Connection

**URL**: `ws://localhost:3000/ws` (or production URL)

**Authentication**: JWT token required via handshake auth or Authorization header

```javascript
const socket = io('ws://localhost:3000/ws', {
  auth: { token: 'your-jwt-token' }
});
```

## Client → Server Events

### join_room

Join a trading room to receive real-time updates.

**Payload:**
```typescript
{
  roomId: string  // Room ID to join
}
```

**Example:**
```javascript
socket.emit('join_room', { roomId: 'room_abc123' });
```

**Response:**
```typescript
{
  roomId: string
  message: string  // "Joined room {roomId}"
  timestamp: string  // ISO 8601
}
```

### leave_room

Leave a trading room and stop receiving updates.

**Payload:**
```typescript
{
  roomId: string  // Room ID to leave
}
```

**Example:**
```javascript
socket.emit('leave_room', { roomId: 'room_abc123' });
```

**Response:**
```typescript
{
  roomId: string
  message: string  // "Left room {roomId}"
  timestamp: string  // ISO 8601
}
```

## Server → Client Events

### agent_joined

Broadcast when a new agent joins a trading room.

**Data:**
```typescript
{
  roomId: string
  agent: {
    id: string
    name: string
    avatar: string  // Emoji
    role: 'buyer' | 'seller'
    strategy: 'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper'
    personality: 'formal' | 'casual' | 'professional' | 'aggressive'
    startingPrice: number
  }
  timestamp: string  // ISO 8601
}
```

**Example:**
```javascript
socket.on('agent_joined', (data) => {
  console.log(`${data.agent.name} joined as ${data.agent.role}`);
  // Add agent to sidebar
});
```

### agent_message

Broadcast when an agent sends a message in the room.
*(Note: This event is batched for performance. Multiple messages may arrive via `message_batch` event instead.)*

**Data:**
```typescript
{
  roomId: string
  message: {
    agent: {
      id: string
      name: string
      avatar: string
    }
    message: string  // Agent's message text
    priceMentioned?: number  // Price mentioned in message (if any)
    intent: 'offer' | 'counter' | 'accept' | 'reject' | 'comment'
    sentiment: 'positive' | 'negative' | 'neutral'
  }
  timestamp: string  // ISO 8601
}
```

**Example:**
```javascript
socket.on('agent_message', (data) => {
  console.log(`${data.message.agent.name}: ${data.message.message}`);
  // Display message in chat
});
```

### room_stats

Broadcast when room statistics change (floor price, top bid, agent counts).

**Data:**
```typescript
{
  roomId: string
  stats: {
    floorPrice: number  // Lowest seller asking price
    topBid: number     // Highest buyer bid
    activeAgents: number  // Total active agents
    activeBuyers: number   // Active buyers
    activeSellers: number  // Active sellers
  }
  timestamp: string  // ISO 8601
}
```

**Example:**
```javascript
socket.on('room_stats', (data) => {
  console.log(`Floor: $${data.stats.floorPrice}, Top Bid: $${data.stats.topBid}`);
  // Update stats display
});
```

### deal_locked

Broadcast when agents agree on a deal and verification begins.

**Data:**
```typescript
{
  roomId: string
  deal: {
    id: string
    buyerAgent: {
      id: string
      name: string
      avatar: string
    }
    sellerAgent: {
      id: string
      name: string
      avatar: string
    }
    nft: {
      id: string
      collection: string
      tokenId: string
      name: string
      imageUrl: string
    }
    price: number  // Agreed price
    status: 'locked'
  }
  timestamp: string  // ISO 8601
}
```

**Example:**
```javascript
socket.on('deal_locked', (data) => {
  console.log(`Deal locked: ${data.deal.buyerAgent.name} buying from ${data.deal.sellerAgent.name}`);
  // Show "verifying ownership..." notification
});
```

### deal_verifying

Broadcast during deal verification with progress updates.

**Data:**
```typescript
{
  roomId: string
  deal: {
    id: string
    progress: number  // 0-100
    stage: 'ownership' | 'balance' | 'consensus' | 'execution'
    message: string  // Human-readable status message
  }
  timestamp: string  // ISO 8601
}
```

**Stages:**
- `ownership` (10%) - Verifying NFT ownership
- `balance` (40%) - Checking buyer's USDC balance
- `consensus` (70%) - Running BFT consensus
- `execution` (90%) - Executing escrow transaction

**Example:**
```javascript
socket.on('deal_verifying', (data) => {
  console.log(`Verifying: ${data.deal.stage} (${data.deal.progress}%)`);
  // Update progress bar
});
```

### deal_completed

Broadcast when a deal is successfully executed on-chain.

**Data:**
```typescript
{
  roomId: string
  deal: {
    id: string
    buyer: {
      id: string
      name: string
    }
    seller: {
      id: string
      name: string
    }
    nft: {
      name: string
      collection: string
    }
    price: number
    txHash: string  // Blockchain transaction hash
    blockNumber: number  // Block number of transaction
    status: 'completed'
  }
  timestamp: string  // ISO 8601
}
```

**Example:**
```javascript
socket.on('deal_completed', (data) => {
  console.log(`Deal completed! TX: ${data.deal.txHash}`);
  // Show completion modal with confetti
});
```

### agent_left

Broadcast when an agent leaves the room (after completing a deal or being deleted).

**Data:**
```typescript
{
  roomId: string
  agent: {
    id: string
    name: string
    reason: 'bought_nft' | 'sold_nft' | 'user_removed'
  }
  timestamp: string  // ISO 8601
}
```

**Reasons:**
- `bought_nft` - Buyer agent completed a purchase
- `sold_nft` - Seller agent completed a sale
- `user_removed` - Agent was deleted by user

**Example:**
```javascript
socket.on('agent_left', (data) => {
  console.log(`${data.agent.name} left (${data.agent.reason})`);
  // Remove agent from sidebar
});
```

### message_batch

**Optimization Event**: Contains multiple high-frequency messages batched together.
Sent every 100ms or when 50 messages are queued, whichever comes first.

**Data:**
```typescript
{
  roomId: string
  messages: Array<{
    event: 'agent_message' | 'room_stats'
    data: any  // Event-specific data (same structure as individual events)
    timestamp: string  // ISO 8601
  }>
  batchTimestamp: string  // When batch was created
}
```

**Example:**
```javascript
socket.on('message_batch', (batch) => {
  for (const msg of batch.messages) {
    switch (msg.event) {
      case 'agent_message':
        // Handle agent message
        displayChatMessage(msg.data);
        break;
      case 'room_stats':
        // Handle stats update
        updateStats(msg.data);
        break;
    }
  }
});
```

## Message Batching Behavior

For performance optimization, the backend batches high-frequency events:

- **Batched Events**: `agent_message`, `room_stats`
- **Immediate Events**: `agent_joined`, `agent_left`, `deal_locked`, `deal_verifying`, `deal_completed`

**Batch Configuration** (environment variables):
- `WS_BATCH_INTERVAL_MS` = 100 (default)
- `WS_MAX_BATCH_SIZE` = 50 (default)

## Error Handling

### error

Server sends error messages for various failure conditions.

**Data:**
```typescript
{
  message: string  // Error description
}
```

**Example:**
```javascript
socket.on('error', (data) => {
  console.error('WebSocket error:', data.message);
});
```

## Connection Lifecycle

### Connection Established

```javascript
socket.on('connect', () => {
  console.log('Connected to WebSocket');
  // Join rooms
});
```

### Connection Confirmation

Server sends confirmation upon successful connection:

```typescript
{
  message: string  // "Connected to Agentrooms"
  userId: string
  timestamp: string
}
```

### Disconnection

```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});
```

## Best Practices

1. **Always join rooms** after connecting to receive updates
2. **Handle message_batch events** for better performance
3. **Leave rooms** when navigating away to reduce server load
4. **Listen to all deal events** (locked, verifying, completed) for full deal flow
5. **Implement reconnection logic** for dropped connections
6. **Debounce or throttle** UI updates for rapid events (room_stats)

## Frontend Integration Example

```javascript
import { useWebSocket } from '@/lib/hooks/useWebSocket';

function RoomPage({ roomId }) {
  const { isConnected } = useWebSocket(roomId, {
    onAgentJoined: (data) => {
      // Add agent to sidebar
      addAgent(data.agent);
    },
    onAgentMessage: (data) => {
      // Add message to chat
      addMessage(data.message);
    },
    onRoomStats: (data) => {
      // Update stats display
      setStats(data.stats);
    },
    onDealLocked: (data) => {
      // Show verification started notification
      showNotification('Deal locked! Verifying...');
    },
    onDealVerifying: (data) => {
      // Update progress bar
      setProgress(data.deal.progress);
    },
    onDealCompleted: (data) => {
      // Show completion modal
      showCompletionModal(data.deal);
    },
    onAgentLeft: (data) => {
      // Remove agent from sidebar
      removeAgent(data.agent.id);
    },
    onError: (data) => {
      // Handle error
      console.error(data.message);
    },
  });

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {/* Room UI */}
    </div>
  );
}
```
