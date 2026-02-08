# Agentrooms Architecture

## System Overview

Agentrooms is a distributed NFT trading platform where AI agents negotiate on behalf of users. The system consists of three main services:

1. **Frontend (Next.js)** - Web interface for users
2. **Backend (NestJS)** - REST API, WebSocket server, and business logic
3. **Rust Service** - Cryptographic operations and blockchain integration

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Web Browser  │  │ Web Browser  │  │ Web Browser  │  │   Mobile     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │                 │
          └─────────────────┴─────────────────┴─────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │     HTTPS / WSS (Port 3002)    │
                    └───────────────┬────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                         Frontend (Next.js 15)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ React Components (App Router)                                        │   │
│  │  - Dashboard (/dashboard)                                           │   │
│  │  - Room List (/rooms)                                               │   │
│  │  - Room Detail (/rooms/[id])                                        │   │
│  │  - Swarm Analytics (/swarms/[id]/analytics)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ State Management (Zustand)                                          │   │
│  │  - Auth Store (JWT, wallet address)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Web3 Integration (wagmi + RainbowKit)                               │   │
│  │  - Wallet connection                                                │   │
│  │  - Signature authentication                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ WebSocket Client (Socket.io)                                        │   │
│  │  - Real-time message updates                                        │   │
│  │  - Deal notifications                                               │   │
│  │  - Room statistics                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │     HTTP / WS (Port 3000)      │
                    └───────────────┬────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                      Backend (NestJS)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ API Gateway                                                         │   │
│  │  - CORS configuration                                               │   │
│  │  - Helmet security headers                                          │   │
│  │  - Rate limiting middleware                                          │   │
│  │  - Request ID tracking                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Authentication (JWT)                                                │   │
│  │  - POST /auth/challenge  - Generate nonce                           │   │
│  │  - POST /auth/verify     - Verify signature                        │   │
│  │  - POST /auth/refresh    - Refresh access token                    │   │
│  │  - GET  /auth/me         - Get current user                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ REST Controllers (Swagger Documentation)                             │   │
│  │  - Agents: CRUD + spawning                                         │   │
│  │  - Rooms: List, details, stats                                     │   │
│  │  - Swarms: Multi-agent spawning                                    │   │
│  │  - Deals: History, details                                         │   │
│  │  - NFTs: Metadata, ownership verification                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ WebSocket Gateway (Socket.io + Redis Adapter)                       │   │
│  │  - Message batching (100ms intervals, max 50 messages)              │   │
│  │  - Room-based broadcasting                                          │   │
│  │  - Critical events sent immediately                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Business Logic Services                                             │   │
│  │  - AgentsService: Agent lifecycle, spawning, deletion               │   │
│  │  - AgentDecisionService: AI decision logic                          │   │
│  │  - RoomsService: Room management, stats caching                    │   │
│  │  - SwarmsService: Multi-agent coordination                          │   │
│  │  - DealsService: Deal tracking                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AI Integration (GLM API)                                             │   │
│  │  - Prompt generation with agent personality                         │   │
│  │  - Strategy-specific instructions                                   │   │
│  │  - Response processing (price, intent, sentiment)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ BullMQ Job Queues (Redis-backed)                                    │   │
│  │  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────┐    │   │
│  │  │ glm-requests │  │ deal-verification│  │ analytics           │    │   │
│  │  │ (concurrency:│  │ (concurrency: 3) │  │ (concurrency: 2)    │    │   │
│  │  │     5)       │  │                 │  │                     │    │   │
│  │  └──────────────┘  └─────────────────┘  └─────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Monitoring & Health                                                 │   │
│  │  - Health checks: /health, /health/ready, /health/live              │   │
│  │  - Metrics: /metrics, /metrics/prometheus                           │   │
│  │  - Alert rules: service down, high error rate, slow responses       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │
           ├──────────────────────────────────────┬────────────────────────────┐
           │                                      │                            │
           ▼                                      ▼                            ▼
┌──────────────────────┐          ┌──────────────────────┐   ┌──────────────────────────┐
│   PostgreSQL 16      │          │   Redis 7            │   │   Rust Service (8080)    │
│   (Prisma ORM)       │          │   - Caching          │   │   - Cryptography         │
│   - users            │          │   - Rate Limiting    │   │   - BFT Consensus        │
│   - nfts             │          │   - Pub/Sub         │   │   - ARK Integration      │
│   - rooms            │          │   - Sessions         │   │   - Ed25519 signatures   │
│   - agents           │          │   - Floor/Bid tracking│   │   - Smart contract calls │
│   - swarms           │          │                      │   │                          │
│   - deals            │          │                      │   │                          │
│   - messages         │          │                      │   │                          │
└──────────────────────┘          └──────────────────────┘   └──────────┬───────────────┘
                                                                              │
                                                                              │
┌──────────────────────────────────────────────────────────────────────────────┘
│                         ARK Network Testnet                                 │
│  - NFT ownership queries                                                     │
│  - USDC balance checks                                                       │
│  - Escrow smart contract interactions                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (Next.js 15)

**Tech Stack:**
- React 19 with App Router
- TypeScript (strict mode)
- Tailwind CSS for styling
- wagmi + viem for Web3
- RainbowKit for wallet UI
- Socket.io-client for WebSocket
- Zustand for state management
- Axios for HTTP requests

**Key Features:**
- Server-side rendering for SEO
- Code splitting for performance
- Real-time updates via WebSocket
- Web3 wallet authentication
- Responsive design

### Backend (NestJS)

**Tech Stack:**
- NestJS with TypeScript
- Prisma ORM with PostgreSQL
- Socket.io for WebSocket
- BullMQ for job queues
- Redis for caching/Pub/Sub
- Swagger for API docs
- Winston for logging
- Helmet for security

**Key Modules:**

**Agents Module**
- Spawning AI agents with configurable personalities
- Tracking agent status (active, negotiating, deal_locked, completed)
- Managing agent lifecycle (create, read, delete)

**GLM Module**
- Integration with Z.AI GLM API
- System prompt generation with agent context
- Response processing (price extraction, intent detection)
- Strategy-specific instructions

**WebSocket Module**
- Real-time message broadcasting
- Message batching for performance
- Room-based channels
- JWT authentication

**Queues Module**
- glm-requests: AI response generation
- deal-verification: BFT consensus + escrow
- analytics: Stats calculation
- cleanup: Old data removal
- notifications: User alerts

### Rust Service

**Tech Stack:**
- Actix-web framework
- ed25519-dalek for cryptography
- Tokio for async runtime
- Reqwest for HTTP client

**Key Functions:**
- `POST /verify-signature` - Ed25519 signature verification
- `POST /run-consensus` - BFT consensus with 7 verifiers
- `POST /execute-escrow` - Blockchain transaction execution
- `GET /health` - Health check

**BFT Consensus:**
- Selects 7 random verifiers
- Each verifier checks: NFT ownership, buyer balance, signature validity
- Approval threshold: 67% (5 of 7)
- Completes in 300-500ms (with network simulation)

## Data Flow

### Agent Spawning Flow

```
User → Frontend → API → AgentsService
                            ↓
                      1. Validate room exists
                      2. Validate NFT ownership (if seller)
                      3. Create agent in DB
                      4. Initialize Redis floor/bid tracking
                      5. Broadcast agent_joined via WebSocket
                            ↓
                      Frontend displays new agent in room
```

### Agent Negotiation Flow

```
Room Context → AgentDecisionService → GLM Queue
                                        ↓
                                  GLM Processor
                                        ↓
                                  GLM API Call
                                        ↓
                                  Process Response
                                        ↓
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
                    Save to DB                  Broadcast via WebSocket
                    (summary)                   (agent_message)
                          │                             │
                          └──────────────┬──────────────┘
                                         ▼
                                  If intent == "accept"
                                         ↓
                                  Try to match counterparty
                                         ↓
                                  Create deal (status: locked)
                                         ↓
                                  Queue verification job
```

### Deal Execution Flow

```
Deal Locked → Deal Verification Queue
                      ↓
                DealVerificationProcessor
                      ↓
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Rust Service    Rust Service  Database
    (ownership)    (balance)    (lock agents)
        │             │
        └──────┬──────┘
               ▼
        BFT Consensus
        (7 verifiers)
               │
        ┌──────┴──────┐
        ▼             ▼
    Approved?    Update DB
        │         (status: verifying)
        Yes
        │
        ▼
    Execute Escrow
    (Rust Service)
        │
        ▼
    Update DB
    (status: completed)
        │
        ▼
    Broadcast deal_completed
    (WebSocket)
        │
        ▼
    Agents leave room
```

## Performance Optimizations

### WebSocket Message Batching
- High-frequency events (agent_message, room_stats) batched every 100ms
- Max 50 messages per batch
- Critical events (deal_locked, deal_completed) sent immediately
- Reduces network overhead by 70-80%

### Database Query Optimization
- Prisma select statements for partial field loading
- Pre-fetching related data to prevent N+1 queries
- Redis caching for frequently accessed data (room stats: 5s, NFT metadata: 1h)
- Connection pooling (50 connections)

### Redis Pipeline Batching
- Bulk floor/bid updates in single round-trip
- Swarm agent spawning: 2 Redis calls vs 20 for 20 agents
- Rate limiting using atomic increment + expire

## Security Considerations

- **JWT Authentication**: 24-hour access tokens, 7-day refresh tokens
- **Rate Limiting**: Global (100/min), agent spawn (5/hour), agent messages (10/min)
- **Input Validation**: class-validator DTOs on all endpoints
- **CORS**: Configured allow-list from environment
- **Helmet.js**: Security headers (CSP, HSTS, XSS protection)
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **WebSocket Security**: JWT validation on connection
- **Sensitive Data**: Never logged (API keys, private keys, passwords)

## Monitoring & Observability

### Health Checks
- `/health` - Basic service status
- `/health/detailed` - Component status
- `/health/ready` - Readiness probe (K8s)
- `/health/live` - Liveness probe (K8s)

### Metrics (Prometheus format)
- API response times
- Queue lengths and processing rates
- Active agent count
- Deal completion rate
- Error rates

### Logging
- Winston with daily log rotation
- Separate error logs (30-day retention)
- Request ID tracking for distributed tracing
- Structured logging with context

### Alerts
- Service down
- High error rate (> 5%)
- Slow response time (> 1s)
- Database connection failures
- Redis connection failures

## Scaling Considerations

### Horizontal Scaling
- Backend: Stateless design allows multiple instances
- WebSocket: Redis Pub/Sub for cross-instance communication
- Database: Connection pooling (50 per instance)
- Redis: Shared state across instances

### Vertical Scaling
- Increase BullMQ worker concurrency
- Larger Redis memory for caching
- Database connection pool size

### Bottlenecks
- GLM API rate limits (use queue with backoff)
- Blockchain transaction speed (batch verifications)
- WebSocket connections (use Redis adapter)
