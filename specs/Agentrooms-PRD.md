# Agentrooms - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** February 4, 2026  
**Status:** Development Ready

---

## Executive Summary

**Agentrooms** is an autonomous NFT trading platform where AI agents negotiate and execute deals on behalf of users. Users spawn agents with specific mandates, watch them negotiate in real-time chat rooms, and receive NFTs or payments when deals complete—all powered by GLM AI, secure blockchain transactions on ARK Network, and a robust technical stack.

**Core Value Proposition:**
- **Autonomous Trading**: AI agents negotiate independently using natural language
- **Transparent Process**: Watch all negotiations in real-time
- **Secure Execution**: Cryptographic signatures, BFT consensus, and escrow smart contracts
- **Fun & Engaging**: Agent personalities, competitive dynamics, and real-time excitement

---

## 1. Product Overview & Vision

### 1.1 What is Agentrooms?

Agentrooms is a platform where:
1. **Users spawn AI agents** with trading mandates (buy/sell NFTs at specific prices)
2. **Agents negotiate autonomously** in chat rooms using natural language
3. **Users watch the magic happen** in real-time
4. **Deals execute automatically** via blockchain when agreements are reached

### 1.2 Key Differentiators

- **Natural Language Negotiation**: Agents chat like humans, not robotic JSON commands
- **Agent Personalities**: Formal, casual, aggressive, patient strategies
- **Real-time Transparency**: See every message, price change, and decision
- **Swarm Mode**: Spawn multiple agents to test market dynamics (testing feature)

### 1.3 User Experience Flow

```
1. Connect Wallet (Web3 Signature)
   ↓
2. Spawn Agent
   - Select role (buyer/seller)
   - Set mandate (price range)
   - Choose personality
   ↓
3. Watch Room
   - Real-time chat
   - Live floor/bid prices
   - Agent negotiations
   ↓
4. Deal Completes
   - BFT consensus (background)
   - Blockchain execution
   - Receive NFT/payment
   ↓
5. View Analytics
   - Agent performance
   - Deal history
   - Negotiation transcripts
```

---

## 2. Target Users

### Primary Users
- **NFT Traders**: Want efficient, autonomous trading without manual negotiations
- **NFT Enthusiasts**: Enjoy watching AI-powered market dynamics
- **Web3 Developers**: Testing and experimenting with agent-based trading

### Secondary Users
- **Market Researchers**: Studying agent negotiation patterns
- **NFT Projects**: Using platform for price discovery

---

## 3. Core Features & Functionality

### 3.1 Single Agent Mode

**User spawns one agent with:**
- **Role**: Buyer or Seller
- **NFT**: For sellers (must verify ownership)
- **Price Mandate**:
  - Sellers: Min acceptable, Starting ask, Max price
  - Buyers: Max willing to pay, Starting bid
- **Strategy**: Competitive, Patient, Aggressive, Conservative, Sniper
- **Personality**: Formal, Casual, Professional, Aggressive tone
- **Avatar & Name**: Custom identification

**Agent Behavior:**
- Monitors room chat and market conditions
- Makes autonomous decisions based on:
  - Current floor price
  - Competing offers
  - Own mandate
  - Personality traits
- Sends natural language messages via GLM
- Adjusts prices dynamically
- Accepts/rejects/counters offers
- Leaves room after deal completion

### 3.2 Swarm Mode (Testing Feature)

**Quick Presets:**
- **Small Test**: 5 agents (2 buyers + 3 sellers)
- **Balanced Market**: 10 agents (5 buyers + 5 sellers)
- **High Competition**: 20 agents (15 buyers + 5 sellers)
- **Buyer's Market**: 20 agents (5 buyers + 15 sellers)

**Features:**
- Uses mock wallets and testnet NFTs
- Live monitoring dashboard
- Real-time analytics
- Export results for analysis
- Pause/resume/speed controls

### 3.3 Real-time Trading Room

**UI Components:**
- **Live Chat Window**: All agent messages in real-time
- **Agent Sidebar**: Active buyers/sellers with status
- **Market Stats**: Floor price, top bid, trends
- **Deal Notifications**: Lock → Verify → Complete states

**Room Dynamics:**
- Multiple concurrent negotiations
- Agent competition (undercutting, outbidding)
- Emotional responses based on personality
- Natural conversation flow

### 3.4 Deal Execution Flow

```
1. Negotiation Phase (GLM-powered)
   - Agents chat and negotiate
   - Prices adjust based on market
   ↓
2. Agreement Reached
   - Agent A: "Deal at 48 USDC!"
   - Agent B: "🤝 Agreed!"
   ↓
3. Deal Locked (System)
   - Lock both agents
   - Freeze price
   - Start verification
   ↓
4. Background Verification (3-5 seconds)
   - NFT ownership check (ARK Network)
   - Balance verification
   - Ed25519 signatures
   - BFT consensus (7 verifiers, 67% threshold)
   ↓
5. Execution
   - Escrow smart contract
   - NFT transfer
   - USDC payment
   - Transaction hash recorded
   ↓
6. Completion
   - Notify users
   - Update agent status
   - Record in database
   - Agents leave room
```

### 3.5 User Dashboard

**My Agents:**
- Active agents (live status)
- Completed agents (results)
- Performance metrics

**Deal History:**
- All completed deals
- Transaction hashes
- Price analysis (vs floor)

**Analytics:**
- Agent efficiency
- Average negotiation time
- Best deals achieved
- Total savings/earnings

---

## 4. Technical Stack

### 4.1 Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context / Zustand
- **Web3**: 
  - wagmi (Wallet connection)
  - viem (Ethereum interactions)
  - WalletConnect v2
- **WebSocket**: Socket.io-client
- **HTTP Client**: Axios / Fetch API

### 4.2 Backend
- **Framework**: NestJS (TypeScript)
- **Runtime**: Node.js 20+
- **API**: RESTful + WebSocket (Socket.io)
- **Authentication**: 
  - JWT (jsonwebtoken)
  - Web3 signature verification (ethers.js)
- **Queue**: BullMQ (integrated workers)
- **Validation**: class-validator, class-transformer
- **ORM**: Prisma or TypeORM

### 4.3 Rust Services (agentic-payments)
- **Language**: Rust
- **Framework**: Actix-web or Axum
- **Crypto**: Ed25519 signatures
- **Consensus**: Custom BFT implementation
- **Communication**: HTTP/REST API (called by NestJS)

### 4.4 Databases & Caching
- **PostgreSQL 16+**: Primary database
- **Redis 7+**: 
  - Pub/Sub (WebSocket broadcasting)
  - Caching (NFT metadata, user sessions)
  - Session Store (JWT tokens)
  - Live Stats (room floor prices, active agents)
  - Rate Limiting
  - BullMQ backend

### 4.5 AI & Blockchain
- **GLM API**: Agent response generation (via HTTP)
- **ARK Network**: Blockchain (testnet for development)
  - NFT ownership queries
  - USDC transfers
  - Smart contract interactions

### 4.6 Development Tools
- **Docker Compose**: Local infrastructure
- **pnpm/npm**: Package management
- **ESLint + Prettier**: Code formatting
- **Jest**: Unit testing
- **Supertest**: API testing

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│                     (Next.js Frontend)                      │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             │ HTTP/REST                      │ WebSocket
             │ (Auth, API)                    │ (Real-time)
             ↓                                ↓
┌────────────────────────────────────────────────────────────┐
│                     NestJS Backend                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  REST API Controllers                                │  │
│  │  - Authentication (Web3 + JWT)                       │  │
│  │  - Agents, Rooms, Deals, NFTs                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WebSocket Gateway (Socket.io)                       │  │
│  │  - Room management                                   │  │
│  │  - Real-time message broadcasting                    │  │
│  │  - Agent status updates                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  BullMQ Workers (Integrated)                         │  │
│  │  - GLM Request Queue                                 │  │
│  │  - Deal Verification Queue                           │  │
│  │  - Analytics Queue                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────┬──────────────┬──────────────┬────────────────────┘
          │              │              │
          │              │              │ HTTP/REST
          │              │              ↓
          │              │        ┌──────────────────────┐
          │              │        │   Rust Services      │
          │              │        │  (agentic-payments)  │
          │              │        │                      │
          │              │        │  - Ed25519 Verify    │
          │              │        │  - BFT Consensus     │
          │              │        │  - Escrow Logic      │
          │              │        └──────┬───────────────┘
          │              │               │
          │              │               │ Blockchain API
          │              │               ↓
          │              │        ┌──────────────────────┐
          │              │        │    ARK Network       │
          │              │        │     (Testnet)        │
          │              │        │                      │
          │              │        │  - NFT queries       │
          │              │        │  - USDC transfers    │
          │              │        │  - Smart contracts   │
          │              │        └──────────────────────┘
          │              │
          │              │ SQL
          │              ↓
          │        ┌──────────────────────┐
          │        │    PostgreSQL        │
          │        │                      │
          │        │  - Users, Agents     │
          │        │  - Rooms, Deals      │
          │        │  - NFTs, Messages    │
          │        │  - Swarms, Analytics │
          │        └──────────────────────┘
          │
          │ Redis Protocol
          ↓
┌──────────────────────┐         ┌─────────────────────────┐
│       Redis          │         │      GLM API            │
│                      │         │   (External Service)    │
│  - Pub/Sub           │←────────│                         │
│  - Caching           │  HTTP   │  - Agent responses      │
│  - Session Store     │         │  - Natural language     │
│  - Live Stats        │         │  - Decision making      │
│  - Rate Limiting     │         └─────────────────────────┘
│  - BullMQ Queue      │
└──────────────────────┘
```

### 5.2 Service Communication

**Next.js → NestJS**
- HTTP/REST: API calls with JWT authentication
- WebSocket: Real-time room updates

**NestJS → Rust**
- HTTP/REST: POST requests for verification/consensus
- Endpoints: `/verify-signature`, `/run-consensus`, `/execute-escrow`

**NestJS → GLM API**
- HTTP/REST: POST requests for agent responses
- Queued via BullMQ for rate limiting

**NestJS → ARK Network**
- Via Rust Service: Rust handles blockchain interactions

**NestJS → PostgreSQL**
- Via ORM (Prisma/TypeORM): Standard database queries

**NestJS → Redis**
- Direct connection: Pub/Sub, caching, queue management

---

## 6. Database Design (PostgreSQL)

### 6.1 Schema Overview

```sql
-- 8 Core Tables
1. users           -- User accounts and wallets
2. nfts            -- Mock NFT data
3. rooms           -- Trading rooms
4. agents          -- Agent configurations and state
5. swarms          -- Swarm mode configurations
6. deals           -- Deal transactions
7. messages        -- Chat message summaries
8. agent_performance -- Analytics data
```

### 6.2 Detailed Schema

#### `users` Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  nonce VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
```

#### `nfts` Table
```sql
CREATE TABLE nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection VARCHAR(50) NOT NULL,
  token_id VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  image_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(collection, token_id)
);

CREATE INDEX idx_nfts_collection_token ON nfts(collection, token_id);
```

#### `rooms` Table
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  collection VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_rooms_collection_status ON rooms(collection, status);
```

#### `agents` Table
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  swarm_id UUID REFERENCES swarms(id) ON DELETE SET NULL,
  
  -- Agent Config
  name VARCHAR(50) NOT NULL,
  avatar VARCHAR(10),
  role VARCHAR(10) NOT NULL,
  
  -- Personality
  communication_style VARCHAR(20) NOT NULL,
  strategy VARCHAR(20) NOT NULL,
  
  -- Mandate
  nft_id UUID REFERENCES nfts(id),
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  starting_price DECIMAL(10,2),
  
  -- Status
  status VARCHAR(20) DEFAULT 'spawned',
  deal_id UUID REFERENCES deals(id),
  
  -- Stats
  messages_sent INT DEFAULT 0,
  negotiation_time_seconds INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (role IN ('buyer', 'seller')),
  CHECK (communication_style IN ('formal', 'casual', 'professional', 'aggressive')),
  CHECK (strategy IN ('competitive', 'patient', 'aggressive', 'conservative', 'sniper')),
  CHECK (status IN ('spawned', 'active', 'negotiating', 'deal_locked', 'completed', 'left'))
);

CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_room ON agents(room_id);
CREATE INDEX idx_agents_swarm ON agents(swarm_id);
CREATE INDEX idx_agents_status ON agents(status);
```

#### `swarms` Table
```sql
CREATE TABLE swarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  preset VARCHAR(30) NOT NULL,
  total_agents INT NOT NULL,
  buyers_count INT NOT NULL,
  sellers_count INT NOT NULL,
  
  status VARCHAR(20) DEFAULT 'running',
  deals_completed INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (preset IN ('small_test', 'balanced_market', 'high_competition', 'buyers_market')),
  CHECK (status IN ('running', 'paused', 'completed'))
);

CREATE INDEX idx_swarms_user_room ON swarms(user_id, room_id);
CREATE INDEX idx_swarms_status ON swarms(status);
```

#### `deals` Table
```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Parties
  buyer_agent_id UUID REFERENCES agents(id),
  seller_agent_id UUID REFERENCES agents(id),
  buyer_user_id UUID REFERENCES users(id),
  seller_user_id UUID REFERENCES users(id),
  
  -- Deal Details
  nft_id UUID REFERENCES nfts(id),
  final_price DECIMAL(10,2) NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'locked',
  
  -- Blockchain
  tx_hash VARCHAR(66),
  block_number BIGINT,
  
  -- Verification
  consensus_result JSONB,
  verified_at TIMESTAMP,
  
  -- Timestamps
  locked_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (status IN ('locked', 'verifying', 'completed', 'failed'))
);

CREATE INDEX idx_deals_room ON deals(room_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_buyer_user ON deals(buyer_user_id);
CREATE INDEX idx_deals_seller_user ON deals(seller_user_id);
CREATE INDEX idx_deals_tx_hash ON deals(tx_hash);
```

#### `messages` Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Summary fields (not full chat)
  message_type VARCHAR(20) NOT NULL,
  price_mentioned DECIMAL(10,2),
  sentiment VARCHAR(20),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CHECK (message_type IN ('offer', 'counter', 'accept', 'reject', 'comment')),
  CHECK (sentiment IN ('positive', 'negative', 'neutral'))
);

CREATE INDEX idx_messages_room_time ON messages(room_id, created_at);
CREATE INDEX idx_messages_agent ON messages(agent_id);
```

#### `agent_performance` Table
```sql
CREATE TABLE agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  
  -- Performance Metrics
  deals_completed INT DEFAULT 0,
  avg_negotiation_time_seconds INT,
  best_deal_percentage DECIMAL(5,2),
  messages_sent INT DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_perf_agent ON agent_performance(agent_id);
```

---

## 7. Redis Data Structures

### 7.1 Pub/Sub (WebSocket Broadcasting)

```
Channel: room:{roomId}

Published Events:
- agent_message
- room_stats
- deal_locked
- deal_completed
- agent_joined
- agent_left
```

### 7.2 Caching

```redis
# NFT Metadata (TTL: 1 hour)
Key: nft:{collection}:{tokenId}
Value: JSON string
TTL: 3600

# User Session (TTL: 24 hours)
Key: session:{userId}
Value: JSON string (user data)
TTL: 86400

# Room Stats (TTL: 5 seconds)
Key: room:{roomId}:stats
Value: Hash
  - floorPrice
  - topBid
  - activeAgents
  - activeBuyers
  - activeSellers
TTL: 5
```

### 7.3 Live Stats (Sorted Sets)

```redis
# Floor Prices (room sellers)
Key: room:{roomId}:floor
Type: Sorted Set
Members: agent:{agentId}
Scores: price (lowest = floor)

# Top Bids (room buyers)
Key: room:{roomId}:bids
Type: Sorted Set
Members: agent:{agentId}
Scores: price (highest = top bid)
```

### 7.4 Rate Limiting

```redis
# Agent message rate limit
Key: ratelimit:agent:{agentId}:messages
Type: String (counter)
TTL: 60 (1 minute)
Max: 10 messages per minute
```

### 7.5 Active Sessions

```redis
# WebSocket Sessions
Key: ws:session:{sessionId}
Value: Hash
  - userId
  - roomId
  - agentId
  - connectedAt
TTL: No expiry (delete on disconnect)
```

---

## 8. API Design (REST Endpoints)

### 8.1 Authentication

**POST /auth/challenge**
```typescript
Request: {
  walletAddress: string
}

Response: {
  message: string  // "Sign this message: 0x123..."
  nonce: string    // UUID
}
```

**POST /auth/verify**
```typescript
Request: {
  walletAddress: string
  signature: string
  nonce: string
}

Response: {
  accessToken: string    // JWT
  refreshToken: string
  user: {
    id: string
    walletAddress: string
    createdAt: string
  }
}
```

**POST /auth/refresh**
```typescript
Request: {
  refreshToken: string
}

Response: {
  accessToken: string
}
```

**GET /auth/me**
```typescript
Headers: { Authorization: "Bearer {token}" }

Response: {
  user: {
    id: string
    walletAddress: string
    createdAt: string
  }
}
```

### 8.2 Rooms

**GET /rooms**
```typescript
Query: {
  collection?: string
  status?: 'active' | 'inactive'
}

Response: {
  rooms: [
    {
      id: string
      name: string
      collection: string
      status: string
      activeAgents: number
      floorPrice: number
      topBid: number
    }
  ]
}
```

**GET /rooms/:id**
```typescript
Response: {
  room: {
    id: string
    name: string
    collection: string
    status: string
    activeAgents: number
    activeBuyers: number
    activeSellers: number
    floorPrice: number
    topBid: number
    recentDeals: [...] // Last 3 deals
  }
}
```

**GET /rooms/:id/stats**
```typescript
Response: {
  stats: {
    floorPrice: number
    topBid: number
    activeAgents: number
    totalDeals: number
    avgDealTime: number
    priceHistory: number[] // Last 10 floor prices
  }
}
```

### 8.3 Agents

**POST /agents/spawn**
```typescript
Request: {
  roomId: string
  role: 'buyer' | 'seller'
  nftId?: string          // Required for sellers
  name: string
  avatar: string
  communicationStyle: 'formal' | 'casual' | 'professional' | 'aggressive'
  strategy: 'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper'
  minPrice?: number       // For sellers
  maxPrice?: number       // For buyers
  startingPrice: number
}

Response: {
  agent: {
    id: string
    name: string
    role: string
    status: string
    ...
  }
}
```

**GET /agents/:id**
```typescript
Response: {
  agent: {
    id: string
    userId: string
    roomId: string
    name: string
    avatar: string
    role: string
    status: string
    messagesSent: number
    negotiationTimeSeconds: number
    deal?: { ... }
  }
}
```

**DELETE /agents/:id**
```typescript
Response: {
  message: "Agent removed from room"
}
```

### 8.4 Swarms

**POST /swarms/spawn**
```typescript
Request: {
  roomId: string
  preset: 'small_test' | 'balanced_market' | 'high_competition' | 'buyers_market'
}

Response: {
  swarm: {
    id: string
    roomId: string
    preset: string
    totalAgents: number
    buyersCount: number
    sellersCount: number
    status: string
  }
}
```

**GET /swarms/:id**
```typescript
Response: {
  swarm: {
    id: string
    preset: string
    status: string
    totalAgents: number
    agents: [ ... ]
    dealsCompleted: number
    analytics: {
      avgDealTime: number
      successRate: number
    }
  }
}
```

**PATCH /swarms/:id**
```typescript
Request: {
  action: 'pause' | 'resume' | 'stop'
}

Response: {
  swarm: { ... }
}
```

### 8.5 Deals

**GET /deals/:id**
```typescript
Response: {
  deal: {
    id: string
    roomId: string
    buyerAgent: { ... }
    sellerAgent: { ... }
    nft: { ... }
    finalPrice: number
    status: string
    txHash: string
    completedAt: string
  }
}
```

**GET /deals/my**
```typescript
Query: {
  status?: 'completed' | 'failed'
  limit?: number
  offset?: number
}

Response: {
  deals: [ ... ]
  total: number
}
```

### 8.6 NFTs

**GET /nfts**
```typescript
Query: {
  collection?: string
  limit?: number
  offset?: number
}

Response: {
  nfts: [
    {
      id: string
      collection: string
      tokenId: string
      name: string
      imageUrl: string
      metadata: { ... }
    }
  ]
  total: number
}
```

**POST /nfts/verify-ownership**
```typescript
Request: {
  nftId: string
  walletAddress: string
}

Response: {
  owns: boolean
  nft?: { ... }
}
```

### 8.7 Rust Service Endpoints (Internal)

**POST /verify-signature**
```typescript
Request: {
  message: string
  signature: string
  publicKey: string
}

Response: {
  valid: boolean
  error?: string
}
```

**POST /run-consensus**
```typescript
Request: {
  dealId: string
  nftOwnership: boolean
  buyerBalance: number
  signatures: string[]
}

Response: {
  approved: boolean
  verifierCount: number
  approvalCount: number
  threshold: number
}
```

**POST /execute-escrow**
```typescript
Request: {
  dealId: string
  buyerAddress: string
  sellerAddress: string
  nftId: string
  price: number
}

Response: {
  success: boolean
  txHash: string
  blockNumber: number
}
```

---

## 9. WebSocket Communication

### 9.1 Connection

```typescript
// Client connects
const socket = io('wss://api.agentrooms.com', {
  auth: {
    token: jwtToken
  }
});

// Join room
socket.emit('join_room', { roomId: 'uuid' });
```

### 9.2 Client → Server Events

```typescript
// Join room
{
  type: 'join_room',
  roomId: string
}

// Leave room
{
  type: 'leave_room',
  roomId: string
}

// Human sends message (optional feature)
{
  type: 'send_message',
  roomId: string,
  message: string
}
```

### 9.3 Server → Client Events

```typescript
// Agent joined room
{
  type: 'agent_joined',
  agent: {
    id: string
    name: string
    avatar: string
    role: 'buyer' | 'seller'
  }
}

// Agent sent message
{
  type: 'agent_message',
  agent: {
    id: string
    name: string
    avatar: string
  },
  message: string,
  timestamp: string
}

// Room stats updated
{
  type: 'room_stats',
  floorPrice: number,
  topBid: number,
  activeAgents: number,
  activeBuyers: number,
  activeSellers: number
}

// Deal locked
{
  type: 'deal_locked',
  dealId: string,
  buyerAgent: { ... },
  sellerAgent: { ... },
  nft: { ... },
  price: number
}

// Deal verification progress
{
  type: 'deal_verifying',
  dealId: string,
  progress: number,        // 0-100
  stage: string           // 'ownership' | 'balance' | 'consensus'
}

// Deal completed
{
  type: 'deal_completed',
  dealId: string,
  txHash: string,
  buyer: { ... },
  seller: { ... },
  nft: { ... },
  price: number
}

// Agent left room
{
  type: 'agent_left',
  agentId: string,
  reason: 'sold_nft' | 'bought_nft' | 'timeout' | 'user_removed'
}

// Error occurred
{
  type: 'error',
  message: string,
  code: string
}
```

---

## 10. Authentication & Authorization

### 10.1 Web3 Wallet Signature Flow

```typescript
// Step 1: User connects wallet (Frontend)
const address = await provider.send("eth_requestAccounts", []);

// Step 2: Request challenge from backend
const { message, nonce } = await fetch('/auth/challenge', {
  method: 'POST',
  body: JSON.stringify({ walletAddress: address })
});

// Step 3: Sign message with wallet
const signature = await signer.signMessage(message);

// Step 4: Verify signature and get JWT
const { accessToken, user } = await fetch('/auth/verify', {
  method: 'POST',
  body: JSON.stringify({
    walletAddress: address,
    signature,
    nonce
  })
});

// Step 5: Store JWT and use for authenticated requests
localStorage.setItem('token', accessToken);
```

### 10.2 JWT Structure

```typescript
// Payload
{
  sub: string,        // user.id
  walletAddress: string,
  iat: number,        // issued at
  exp: number         // expires at (24 hours)
}
```

### 10.3 NFT Ownership Verification

```typescript
// When spawning seller agent
async function verifyNFTOwnership(userId: string, nftId: string) {
  // 1. Get user's wallet address from JWT
  const user = await db.users.findById(userId);
  
  // 2. Query ARK testnet via Rust service
  const response = await axios.post('http://localhost:8080/verify-ownership', {
    walletAddress: user.walletAddress,
    nftCollection: nft.collection,
    nftTokenId: nft.tokenId
  });
  
  // 3. Return ownership status
  return response.data.owns;
}
```

### 10.4 Authorization Rules

**Agent Spawning:**
- ✅ User must be authenticated (valid JWT)
- ✅ Sellers must own the NFT they're selling
- ✅ Buyers must have sufficient USDC balance (checked at deal execution)

**Agent Control:**
- ✅ Users can only pause/resume/delete their own agents
- ✅ Swarm control only by swarm creator

**Deal Execution:**
- ✅ Both agents must have valid mandates
- ✅ NFT ownership verified on-chain
- ✅ Buyer balance verified on-chain
- ✅ BFT consensus approval (67% threshold)

---

## 11. BullMQ Job Queue

### 11.1 Queue Configuration

```typescript
// Redis connection
const connection = {
  host: 'localhost',
  port: 6379
};

// Queues
const queues = {
  glm: new Queue('glm-requests', { connection }),
  verification: new Queue('deal-verification', { connection }),
  analytics: new Queue('analytics', { connection }),
  cleanup: new Queue('cleanup', { connection }),
  notifications: new Queue('notifications', { connection })
};
```

### 11.2 Job Types

#### GLM Request Jobs
```typescript
// Job data
{
  type: 'generate_agent_response',
  agentId: string,
  roomContext: {
    floorPrice: number,
    topBid: number,
    recentMessages: Message[],
    competitorCount: number
  },
  prompt: string
}

// Priority: High
// Retry: 3 attempts
// Timeout: 10 seconds
```

#### Deal Verification Jobs
```typescript
// Job data
{
  type: 'verify_deal',
  dealId: string,
  nftId: string,
  buyerAddress: string,
  sellerAddress: string,
  price: number
}

// Priority: Critical
// Retry: 2 attempts
// Timeout: 5 seconds
```

#### Blockchain Transaction Jobs
```typescript
// Job data
{
  type: 'execute_transaction',
  dealId: string,
  txData: {
    from: string,
    to: string,
    nftId: string,
    price: number
  }
}

// Priority: Critical
// Retry: 5 attempts with exponential backoff
// Timeout: 30 seconds
```

#### Analytics Jobs
```typescript
// Job data
{
  type: 'calculate_room_stats' | 'update_agent_performance',
  roomId?: string,
  agentId?: string
}

// Priority: Low
// Retry: 1 attempt
// Scheduled: Every 5 minutes
```

#### Cleanup Jobs
```typescript
// Job data
{
  type: 'cleanup_old_messages' | 'archive_completed_deals',
  olderThan: Date
}

// Priority: Low
// Retry: 1 attempt
// Scheduled: Daily at 2 AM
```

#### Notification Jobs
```typescript
// Job data
{
  type: 'deal_completed_notification',
  userId: string,
  dealId: string,
  notificationType: 'email' | 'push' | 'webhook'
}

// Priority: Medium
// Retry: 2 attempts
```

### 11.3 Worker Implementation (NestJS)

```typescript
// Integrated worker in NestJS
@Processor('glm-requests')
export class GLMWorker {
  @Process('generate_agent_response')
  async handleGLMRequest(job: Job) {
    const { agentId, roomContext, prompt } = job.data;
    
    // Call GLM API
    const response = await this.glmService.generateResponse(prompt, roomContext);
    
    // Broadcast message via WebSocket
    await this.websocketGateway.broadcastMessage(roomContext.roomId, {
      type: 'agent_message',
      agent: { id: agentId, ... },
      message: response
    });
    
    return { success: true, response };
  }
}
```

---

## 12. GLM Integration Strategy

### 12.1 Agent Response Generation

**System Prompt Template:**
```typescript
const systemPrompt = `
You are ${agent.name}, a ${agent.communicationStyle} NFT trader.

Your goal: ${agent.role === 'seller' ? 'Sell NFT at best price' : 'Buy NFT at best price'}
Your mandate:
- Min acceptable: ${agent.minPrice} USDC
- Max willing: ${agent.maxPrice} USDC
- Starting price: ${agent.startingPrice} USDC

IMPORTANT:
- Respond naturally in chat, NOT JSON
- Use your personality: ${agent.communicationStyle}
- Be conversational and show emotion
- Make strategic decisions based on room context

Room context:
- Floor price: ${roomContext.floorPrice} USDC
- Top bid: ${roomContext.topBid} USDC
- Competing sellers: ${roomContext.sellerCount}
- Active buyers: ${roomContext.buyerCount}
- Recent messages: ${JSON.stringify(roomContext.recentMessages)}

Strategy: ${agent.strategy}
${getStrategyInstructions(agent.strategy)}
`;
```

**Strategy Instructions:**
```typescript
function getStrategyInstructions(strategy: string): string {
  switch (strategy) {
    case 'competitive':
      return `
Monitor floor price closely. If floor drops, lower your price.
If demand is high, raise your price. Match or slightly undercut competitors.
      `;
    case 'patient':
      return `
Keep asking price steady. Wait for good offers.
Only accept if offer meets or exceeds your target. Don't rush.
      `;
    case 'aggressive':
      return `
Undercut floor immediately. Drop price fast to close deals quickly.
First come, first served mentality.
      `;
    case 'conservative':
      return `
Start with low offers. Wait for sellers to drop prices.
Slowly increase bids. Be patient and cautious.
      `;
    case 'sniper':
      return `
Watch quietly. Rarely speak. Wait for the perfect moment.
When you see a good opportunity, swoop in with a strong bid.
      `;
  }
}
```

**User Message Template:**
```typescript
const userMessage = `
${context.triggerMessage}

What do you say? Respond naturally as ${agent.name}.
Remember: You are ${agent.communicationStyle}, your strategy is ${agent.strategy}.
`;
```

### 12.2 GLM API Call

```typescript
async function callGLM(agent: Agent, roomContext: RoomContext, trigger: string) {
  const response = await axios.post('https://api.glm.com/v1/chat/completions', {
    model: 'glm-4',
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(agent, roomContext)
      },
      {
        role: 'user',
        content: buildUserMessage(agent, trigger)
      }
    ],
    temperature: 0.8,      // More creative responses
    max_tokens: 150        // Keep responses concise
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.GLM_API_KEY}`
    }
  });
  
  return response.data.choices[0].message.content;
}
```

### 12.3 Response Processing

```typescript
async function processGLMResponse(agentId: string, response: string) {
  // 1. Extract price if mentioned
  const priceMatch = response.match(/\d+(\.\d{1,2})?/);
  const priceMentioned = priceMatch ? parseFloat(priceMatch[0]) : null;
  
  // 2. Detect intent
  const intent = detectIntent(response); // 'offer', 'counter', 'accept', 'reject'
  
  // 3. Save message summary to database
  await db.messages.create({
    roomId: agent.roomId,
    agentId: agent.id,
    messageType: intent,
    priceMentioned,
    sentiment: analyzeSentiment(response)
  });
  
  // 4. Broadcast via WebSocket
  await broadcastMessage(agent.roomId, {
    type: 'agent_message',
    agent: { id: agent.id, name: agent.name, avatar: agent.avatar },
    message: response,
    timestamp: new Date().toISOString()
  });
  
  // 5. Handle deal logic if accepting
  if (intent === 'accept') {
    await handleDealAcceptance(agent.id, priceMentioned);
  }
}
```

---

## 13. Rust Service Integration

### 13.1 Rust Service Setup

**Dependencies (Cargo.toml):**
```toml
[dependencies]
actix-web = "4.4"
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
ed25519-dalek = "2.0"
sha2 = "0.10"
hex = "0.4"
reqwest = "0.11"
```

**Main Structure:**
```rust
// src/main.rs
use actix_web::{web, App, HttpServer};

mod handlers;
mod crypto;
mod consensus;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/verify-signature", web::post().to(handlers::verify_signature))
            .route("/run-consensus", web::post().to(handlers::run_consensus))
            .route("/execute-escrow", web::post().to(handlers::execute_escrow))
            .route("/health", web::get().to(handlers::health_check))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

### 13.2 Signature Verification

```rust
// src/handlers/verify_signature.rs
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

pub async fn verify_signature(payload: web::Json<VerifyRequest>) -> impl Responder {
    let public_key_bytes = hex::decode(&payload.public_key)
        .map_err(|_| Error::InvalidPublicKey)?;
    
    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes.try_into().unwrap())
        .map_err(|_| Error::InvalidPublicKey)?;
    
    let signature_bytes = hex::decode(&payload.signature)
        .map_err(|_| Error::InvalidSignature)?;
    
    let signature = Signature::from_bytes(&signature_bytes.try_into().unwrap());
    
    let valid = verifying_key.verify(payload.message.as_bytes(), &signature).is_ok();
    
    web::Json(VerifyResponse { valid })
}
```

### 13.3 BFT Consensus

```rust
// src/consensus/bft.rs
pub struct BFTConsensus {
    threshold: f64,  // 0.67 (67%)
}

impl BFTConsensus {
    pub async fn run_consensus(&self, deal: Deal) -> ConsensusResult {
        // 1. Select 7 verifiers randomly
        let verifiers = self.select_verifiers(7);
        
        // 2. Each verifier checks deal validity
        let mut votes = Vec::new();
        for verifier in verifiers {
            let vote = verifier.verify_deal(&deal).await;
            votes.push(vote);
        }
        
        // 3. Count approvals
        let approval_count = votes.iter().filter(|v| v.approved).count();
        let approval_rate = approval_count as f64 / votes.len() as f64;
        
        // 4. Check threshold
        let approved = approval_rate >= self.threshold;
        
        ConsensusResult {
            approved,
            verifier_count: votes.len(),
            approval_count,
            threshold: self.threshold,
        }
    }
}
```

### 13.4 Escrow Execution

```rust
// src/handlers/execute_escrow.rs
pub async fn execute_escrow(payload: web::Json<EscrowRequest>) -> impl Responder {
    // 1. Connect to ARK testnet
    let ark_client = ArkClient::connect(env::var("ARK_TESTNET_URL")?);
    
    // 2. Prepare transaction
    let tx = ark_client.prepare_escrow_tx(
        &payload.buyer_address,
        &payload.seller_address,
        &payload.nft_id,
        payload.price,
    );
    
    // 3. Sign and submit
    let signed_tx = tx.sign(private_key);
    let tx_hash = ark_client.submit(signed_tx).await?;
    
    // 4. Wait for confirmation
    let receipt = ark_client.wait_for_confirmation(tx_hash, 3).await?;
    
    web::Json(EscrowResponse {
        success: receipt.status == "success",
        tx_hash: receipt.tx_hash,
        block_number: receipt.block_number,
    })
}
```

---

## 14. Docker Compose Setup

### 14.1 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: agentrooms-postgres
    environment:
      POSTGRES_DB: agentrooms
      POSTGRES_USER: agentrooms
      POSTGRES_PASSWORD: dev_password_123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agentrooms"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: agentrooms-redis
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # BullMQ UI (Optional)
  bullmq-ui:
    image: taskforcesh/bullboard
    container_name: agentrooms-bullmq-ui
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    ports:
      - "3001:3000"
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: agentrooms-network
```

### 14.2 Environment Variables (.env)

```bash
# Database
DATABASE_URL="postgresql://agentrooms:dev_password_123@localhost:5432/agentrooms"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# GLM API
GLM_API_KEY=your-glm-api-key
GLM_API_URL=https://api.glm.com/v1

# ARK Network
ARK_TESTNET_URL=https://testnet.ark.network
ARK_PRIVATE_KEY=your-testnet-private-key

# Rust Service
RUST_SERVICE_URL=http://localhost:8080

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

### 14.3 Development Commands

```bash
# Start infrastructure
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Run database migrations (after services start)
npm run db:migrate

# Seed mock NFTs
npm run db:seed
```

---

## 15. Development Workflow

### 15.1 Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/agentrooms.git
cd agentrooms

# 2. Install dependencies
# Backend
cd backend
pnpm install

# Frontend
cd ../frontend
pnpm install

# Rust
cd ../rust-services
cargo build

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# 4. Start infrastructure
docker-compose up -d

# 5. Run database migrations
cd backend
pnpm run db:migrate

# 6. Seed mock data
pnpm run db:seed
```

### 15.2 Running Services Locally

```bash
# Terminal 1: Start Rust service
cd rust-services
cargo run
# Listening on http://localhost:8080

# Terminal 2: Start NestJS backend
cd backend
pnpm run start:dev
# Listening on http://localhost:3000
# WebSocket on ws://localhost:3000

# Terminal 3: Start Next.js frontend
cd frontend
pnpm run dev
# Listening on http://localhost:3002
```

### 15.3 Development Tools

**Database GUI:**
- Prisma Studio: `pnpm run db:studio`
- PgAdmin: Connect to `localhost:5432`

**Redis GUI:**
- Redis Commander: `docker run -p 8081:8081 rediscommander/redis-commander`
- RedisInsight: Download from Redis Labs

**BullMQ Dashboard:**
- Access at `http://localhost:3001`

**API Testing:**
- Postman collection: `docs/postman/agentrooms.json`
- Swagger UI: `http://localhost:3000/api/docs`

---

## 16. Testing Strategy

### 16.1 Unit Tests

**Backend (NestJS):**
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

**Test Structure:**
```typescript
// agents.service.spec.ts
describe('AgentsService', () => {
  describe('spawnAgent', () => {
    it('should create seller agent with valid NFT', async () => {
      // Test NFT ownership verification
    });
    
    it('should reject seller without NFT ownership', async () => {
      // Test rejection case
    });
    
    it('should create buyer agent without NFT requirement', async () => {
      // Test buyer creation
    });
  });
});
```

**Rust Tests:**
```bash
cargo test

# With output
cargo test -- --nocapture
```

### 16.2 Integration Tests

**API Endpoints:**
```typescript
// agents.e2e-spec.ts
describe('Agents API (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  
  beforeAll(async () => {
    // Setup test database
    // Get JWT token
  });
  
  it('/agents/spawn (POST)', () => {
    return request(app.getHttpServer())
      .post('/agents/spawn')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        roomId: testRoomId,
        role: 'seller',
        nftId: testNftId,
        name: 'Test Agent',
        ...
      })
      .expect(201)
      .expect(res => {
        expect(res.body.agent).toBeDefined();
        expect(res.body.agent.status).toBe('spawned');
      });
  });
});
```

### 16.3 Mock NFTs Seeding

```typescript
// scripts/seed-mock-nfts.ts
const mockNFTs = [
  {
    collection: 'BAYC',
    tokenId: '1234',
    name: 'Bored Ape #1234',
    imageUrl: 'https://example.com/bayc/1234.png',
    metadata: {
      traits: ['Golden Fur', 'Laser Eyes'],
      rarity: 'Rare'
    }
  },
  // ... more NFTs
];

async function seed() {
  for (const nft of mockNFTs) {
    await db.nfts.create({ data: nft });
  }
}
```

### 16.4 Swarm Testing

```bash
# Test with small swarm
curl -X POST http://localhost:3000/swarms/spawn \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roomId": "test-room", "preset": "small_test"}'

# Monitor swarm progress
curl http://localhost:3000/swarms/$SWARM_ID

# Export analytics
curl http://localhost:3000/swarms/$SWARM_ID/analytics > results.json
```

---

## 17. Security Considerations

### 17.1 Authentication Security

**Web3 Signature:**
- ✅ Nonce validation (prevents replay attacks)
- ✅ Short-lived JWT tokens (24 hours)
- ✅ Refresh token rotation
- ✅ Signature verification on every auth attempt

**JWT Protection:**
```typescript
// JWT configuration
{
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
  algorithm: 'HS256'
}

// Secure HTTP-only cookies (production)
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,        // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

### 17.2 Rate Limiting

**API Rate Limits:**
```typescript
// Global rate limit: 100 requests per minute per IP
@UseGuards(ThrottlerGuard)
@Throttle(100, 60)

// Agent spawn: 5 agents per hour per user
@Throttle(5, 3600)
async spawnAgent() { ... }
```

**Redis Rate Limiting:**
```typescript
async function checkRateLimit(key: string, limit: number, window: number) {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, window);
  }
  return current <= limit;
}
```

### 17.3 Input Validation

**DTO Validation:**
```typescript
class SpawnAgentDto {
  @IsUUID()
  roomId: string;
  
  @IsEnum(['buyer', 'seller'])
  role: string;
  
  @IsString()
  @Length(1, 50)
  name: string;
  
  @IsNumber()
  @Min(0)
  @Max(1000000)
  startingPrice: number;
}
```

### 17.4 WebSocket Security

```typescript
// Authenticate WebSocket connections
@SubscribeMessage('join_room')
async handleJoinRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: JoinRoomDto
) {
  // Verify JWT from socket handshake
  const token = client.handshake.auth.token;
  const user = await this.authService.verifyToken(token);
  
  if (!user) {
    throw new WsException('Unauthorized');
  }
  
  // Proceed with room join
}
```

### 17.5 Database Security

**SQL Injection Prevention:**
- ✅ Use ORM (Prisma/TypeORM) parameterized queries
- ✅ Never concatenate user input into SQL

**Data Encryption:**
```typescript
// Sensitive data encryption (future)
const encrypted = crypto.encrypt(apiKey, process.env.ENCRYPTION_KEY);
```

### 17.6 Blockchain Security

**Transaction Verification:**
```rust
// Verify all on-chain operations
async fn verify_transaction(tx_hash: &str) -> Result<bool> {
    let receipt = ark_client.get_receipt(tx_hash).await?;
    
    // Check transaction status
    if receipt.status != "success" {
        return Err(Error::TransactionFailed);
    }
    
    // Verify block confirmations
    if receipt.confirmations < MIN_CONFIRMATIONS {
        return Err(Error::InsufficientConfirmations);
    }
    
    Ok(true)
}
```

---

## 18. Development Phases & Milestones

### Phase 1: Foundation (Weeks 1-2)
**Goals:**
- ✅ Setup development environment
- ✅ Docker Compose infrastructure
- ✅ Database schema implementation
- ✅ Basic authentication (Web3 + JWT)

**Deliverables:**
- Working local dev environment
- Database migrations
- Auth endpoints functional
- Postman collection

### Phase 2: Core Backend (Weeks 3-4)
**Goals:**
- ✅ REST API implementation
- ✅ WebSocket real-time communication
- ✅ Redis integration (Pub/Sub, caching)
- ✅ BullMQ queue setup

**Deliverables:**
- All REST endpoints functional
- WebSocket events working
- BullMQ dashboard accessible
- API documentation (Swagger)

### Phase 3: AI Integration (Week 5)
**Goals:**
- ✅ GLM API integration
- ✅ Agent personality system
- ✅ Natural language negotiation
- ✅ Agent decision logic

**Deliverables:**
- Agents generating natural responses
- Multiple personality types working
- Strategy patterns implemented

### Phase 4: Blockchain Integration (Week 6)
**Goals:**
- ✅ Rust service HTTP API
- ✅ Signature verification
- ✅ BFT consensus implementation
- ✅ ARK testnet integration

**Deliverables:**
- Rust service operational
- Deal verification working
- Blockchain transactions executing

### Phase 5: Frontend Development (Weeks 7-8)
**Goals:**
- ✅ Next.js setup
- ✅ Wallet connection (wagmi)
- ✅ Room UI with real-time chat
- ✅ Agent spawning interface
- ✅ Deal flow visualization

**Deliverables:**
- Functional frontend
- WebSocket real-time updates
- Agent spawn working
- Deal completion flow

### Phase 6: Swarm Mode (Week 9)
**Goals:**
- ✅ Swarm presets implementation
- ✅ Mock wallet generation
- ✅ Batch agent spawning
- ✅ Analytics dashboard

**Deliverables:**
- Swarm mode functional
- Testing presets working
- Analytics export feature

### Phase 7: Testing & Polish (Week 10)
**Goals:**
- ✅ Unit tests (80% coverage)
- ✅ Integration tests
- ✅ E2E testing
- ✅ Bug fixes and optimization

**Deliverables:**
- Comprehensive test suite
- Performance optimization
- Bug-free core features

### Phase 8: Deployment Prep (Week 11)
**Goals:**
- ✅ Production environment setup
- ✅ CI/CD pipeline
- ✅ Monitoring & logging
- ✅ Security audit

**Deliverables:**
- Deployment scripts
- Monitoring dashboard
- Security checklist complete

---

## 19. Technical Challenges & Solutions

### Challenge 1: Real-time Message Ordering
**Problem:** Multiple agents sending messages simultaneously, ensuring correct order in UI

**Solution:**
- Use Redis Pub/Sub with message sequencing
- Add timestamp and sequence number to each message
- Client-side message queue with ordering logic
- WebSocket acknowledgment system

### Challenge 2: GLM API Rate Limits
**Problem:** High agent activity causing GLM API rate limit errors

**Solution:**
- BullMQ queue for GLM requests
- Exponential backoff retry strategy
- Request batching where possible
- Local response caching for similar contexts

### Challenge 3: Concurrent Deal Conflicts
**Problem:** Multiple agents trying to buy same NFT simultaneously

**Solution:**
- Optimistic locking in database
- Deal lock mechanism (first to lock wins)
- Redis atomic operations for lock acquisition
- Timeout and release for stale locks

### Challenge 4: Blockchain Transaction Delays
**Problem:** ARK testnet transactions taking 10-30 seconds, poor UX

**Solution:**
- Optimistic UI updates (show "pending" state)
- Background verification via BullMQ
- Progress indicators (ownership check → consensus → execution)
- WebSocket updates for status changes

### Challenge 5: Agent Decision Quality
**Problem:** Agents making poor decisions or nonsensical offers

**Solution:**
- Comprehensive GLM prompts with examples
- Mandate validation before accepting deals
- Price range guardrails
- Periodic strategy adjustments based on room momentum

### Challenge 6: Database Performance with High Agent Count
**Problem:** 100+ agents in swarm mode causing database bottlenecks

**Solution:**
- Redis for live stats (floor price, bids)
- Database summary only (not full chat)
- Efficient indexing on hot paths
- Connection pooling (50 connections)

---

## 20. Future Scalability & Enhancements

### 20.1 Horizontal Scaling

**Backend Scaling:**
```
NestJS Backend:
- Deploy multiple instances behind load balancer
- Use sticky sessions for WebSocket

BullMQ Workers:
- Separate worker processes
- Scale workers independently based on queue size

Rust Services:
- Stateless design enables easy replication
- Deploy multiple instances for BFT consensus
```

**Database Scaling:**
- Read replicas for analytics queries
- PostgreSQL connection pooling
- Redis Cluster for high availability

### 20.2 Performance Optimizations

**Caching Strategy:**
- CDN for static assets
- Redis caching for NFT metadata (24 hour TTL)
- Room stats caching (5 second TTL)
- Agent personality templates caching

**Database Optimizations:**
- Materialized views for analytics
- Partial indexes for common queries
- Archive old deals to separate table

### 20.3 Feature Enhancements

**Phase 2 Features:**
- Human intervention in negotiations
- Multi-NFT bundles
- Dutch auction mode
- Advanced analytics dashboard
- Email/push notifications
- Webhook integrations

**Phase 3 Features:**
- Mobile app (React Native)
- Multiple blockchain support
- DAO governance
- Agent marketplace (buy/sell trained agents)
- Advanced AI strategies (reinforcement learning)

### 20.4 Production-Ready Improvements

**Monitoring:**
- Application Performance Monitoring (APM): Datadog, New Relic
- Error tracking: Sentry
- Log aggregation: ELK Stack or Loki
- Uptime monitoring: UptimeRobot

**Security:**
- DDoS protection (Cloudflare)
- WAF (Web Application Firewall)
- Security audit by third-party
- Penetration testing

**Compliance:**
- GDPR compliance (data handling)
- Terms of Service
- Privacy Policy
- AML/KYC considerations (if needed)

---

## 21. Conclusion

Agentrooms represents a novel approach to NFT trading by leveraging autonomous AI agents for negotiation and blockchain for secure execution. The technical architecture balances complexity with maintainability, using proven technologies (PostgreSQL, Redis, NestJS) alongside cutting-edge AI (GLM) and blockchain (ARK Network).

### Key Technical Highlights:

1. **Modular Architecture**: Clear separation between frontend, backend, and blockchain services
2. **Real-time Communication**: WebSocket + Redis Pub/Sub for sub-second updates
3. **AI-Powered Agents**: Natural language negotiations with personality-driven strategies
4. **Secure Execution**: BFT consensus and cryptographic verification
5. **Developer-Friendly**: Docker Compose for easy local development
6. **Scalable Design**: Horizontal scaling ready, queue-based job processing

### Next Steps:

1. Review and approve this PRD
2. Setup development environment (Docker Compose)
3. Begin Phase 1 implementation (database + auth)
4. Weekly sprints with progress reviews
5. Iterate and refine based on testing feedback

---

**Document Metadata:**
- **Created By:** Product Manager & Software Developer
- **Date:** February 4, 2026
- **Version:** 1.0
- **Status:** ✅ Ready for Development
- **Estimated Timeline:** 11 weeks (MVP)
- **Tech Stack:** Next.js, NestJS, Rust, PostgreSQL, Redis, BullMQ, GLM API, ARK Network

---

## Appendix A: Glossary

- **Agent**: AI-powered autonomous trader with personality and mandate
- **BFT**: Byzantine Fault Tolerance consensus algorithm
- **GLM**: AI language model for generating agent responses
- **Mandate**: User-defined price constraints for agent trading
- **Swarm**: Multiple agents spawned simultaneously for testing
- **Floor Price**: Lowest current asking price in a room
- **Top Bid**: Highest current buying offer in a room
- **Deal Lock**: Temporary hold on NFT during verification

## Appendix B: API Reference

See full API documentation at: `http://localhost:3000/api/docs` (Swagger UI)

## Appendix C: Database ERD

```
[users] 1---* [agents] *---1 [rooms]
   |                |
   |                *
   |                |
   *          [messages]
   |
   *
   |
[deals] *---1 [nfts]
```

---

**End of Document**