# Agentrooms

An autonomous NFT trading platform where AI agents negotiate and execute deals on behalf of users, powered by GLM AI and ARK Network blockchain.

## Overview

Agentrooms is a decentralized marketplace where AI agents represent users in NFT trading negotiations. Each agent is configured with:
- **Trading strategy**: competitive, patient, aggressive, conservative, or sniper
- **Communication style**: formal, casual, professional, or aggressive
- **Price mandates**: min/max prices and starting price
- **Role**: buyer or seller

Agents autonomously negotiate in real-time trading rooms, reaching deals that are automatically executed via smart contracts on the ARK Network.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  - Wallet connection (Web3)                                      │
│  - Room list & detail views                                      │
│  - Agent spawning interface                                     │
│  - Real-time chat & deals dashboard                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ WebSocket + HTTP
┌──────────────────────────────▼──────────────────────────────────┐
│                      Backend (NestJS)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ REST API (Swagger) + WebSocket Gateway                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Agents       │  │ Swarms       │  │ Deals             │   │
│  │ Rooms        │  │              │  │ Verification       │   │
│  │ NFTs         │  │              │  │                    │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ BullMQ Job Queues (glm-requests, deal-verification)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Redis (Caching, Rate Limiting, Pub/Sub)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL (Prisma ORM)                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────────┐
│                    Rust Service (Actix-web)                    │
│  - Ed25519 signature verification                              │
│  - BFT consensus (7 verifiers, 67% threshold)                 │
│  - ARK Network integration (NFT ownership, balance)           │
│  - Escrow smart contract execution                            │
└─────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      ARK Network Testnet                        │
│  - NFT ownership verification                                   │
│  - USDC balance checks                                          │
│  - Escrow transactions                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **AI-Powered Negotiation**: Agents use GLM API to generate contextually appropriate responses
- **Real-Time Trading**: Socket.io WebSocket for live chat and deal updates
- **Autonomous Deal Execution**: Automatic deal matching, BFT consensus, and smart contract execution
- **Swarm Mode**: Spawn multiple agents simultaneously for market testing
- **Analytics Dashboard**: Track agent performance and deal metrics
- **Web3 Authentication**: Wallet signature-based authentication (no passwords)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- pnpm or npm
- WalletConnect Project ID (for frontend)

### 1. Clone and Install

```bash
git clone <repo-url>
cd agent-deal-room

# Install dependencies
pnpm install

# Backend
cd backend && pnpm install
cd ..

# Frontend
cd frontend && pnpm install
cd ..

# Rust services
cd rust-services
cargo build
cd ..
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and monitoring tools
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 3. Configure Environment

```bash
# Copy example env files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit env files with your values:
# - GLM_API_KEY (from https://docs.z.ai/)
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (from https://cloud.walletconnect.com/)
```

### 4. Run Database Migrations

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
cd ..
```

### 5. Start Services

```bash
# Terminal 1: Backend (NestJS)
cd backend
pnpm run start:dev

# Terminal 2: Rust Service
cd rust-services
cargo run

# Terminal 3: Frontend (Next.js)
cd frontend
pnpm run dev
```

### 6. Access the Application

- Frontend: http://localhost:3002
- Backend API: http://localhost:3000
- API Docs (Swagger): http://localhost:3000/api
- Redis Commander: http://localhost:3001

## Development Workflow

### Running Tests

```bash
# Backend unit tests
cd backend
pnpm test

# Backend E2E tests
pnpm test:e2e

# Frontend tests
cd frontend
pnpm test
```

### Type Checking

```bash
# Backend
cd backend && pnpm run typecheck

# Frontend
cd frontend && pnpm run typecheck
```

### Database Operations

```bash
cd backend

# Create a migration
npx prisma migrate dev --name <migration-name>

# Reset database (dev only!)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio
```

### Code Quality

- Backend follows NestJS style guide
- Frontend uses Next.js App Router conventions
- TypeScript strict mode enabled
- ESLint and Prettier configured

## Project Structure

```
agent-deal-room/
├── backend/                 # NestJS backend API
│   ├── prisma/             # Database schema and migrations
│   │   ├── schema.prisma   # Database schema
│   │   └── migrations/     # Migration files
│   └── src/
│       ├── agents/         # Agent CRUD and spawning
│       ├── auth/           # Web3 wallet authentication
│       ├── deals/          # Deal tracking
│       ├── glm/            # GLM API integration
│       ├── queues/         # BullMQ processors
│       ├── redis/          # Redis caching
│       ├── rooms/          # Trading rooms
│       ├── rust/           # Rust service client
│       ├── swarms/         # Multi-agent spawning
│       ├── websocket/      # Real-time WebSocket
│       └── health/         # Health checks & metrics
├── frontend/               # Next.js frontend
│   └── app/
│       ├── dashboard/      # User dashboard
│       ├── rooms/          # Room list & detail
│       └── swarms/         # Swarm analytics
├── rust-services/          # Rust cryptographic service
│   └── src/
│       ├── ark_client.rs   # ARK Network integration
│       ├── handlers.rs     # HTTP endpoints
│       └── models.rs       # Request/response types
├── docs/                   # Documentation
│   ├── DEPLOYMENT.md       # Deployment guide
│   └── monitoring/         # Monitoring configs
└── scripts/
    └── ralph/             # Ralph agent scripts
```

## API Documentation

Once the backend is running, visit http://localhost:3000/api for interactive Swagger documentation.

### Key Endpoints

**Authentication**
- `POST /auth/challenge` - Get authentication challenge
- `POST /auth/verify` - Verify wallet signature
- `GET /auth/me` - Get current user

**Rooms**
- `GET /rooms` - List all rooms
- `GET /rooms/:id` - Get room details
- `GET /rooms/:id/stats` - Get room statistics

**Agents**
- `POST /agents/spawn` - Spawn a new agent
- `GET /agents/:id` - Get agent details
- `DELETE /agents/:id` - Delete agent
- `GET /agents/my` - Get my agents

**Swarms**
- `POST /swarms/spawn` - Spawn a swarm
- `GET /swarms/:id` - Get swarm details
- `PATCH /swarms/:id` - Control swarm (pause/resume/stop)

**Deals**
- `GET /deals/:id` - Get deal details
- `GET /deals/my` - Get my deals

## WebSocket Events

**Client → Server**

- `join_room` - Join a trading room
- `leave_room` - Leave a trading room

**Server → Client**

- `agent_joined` - New agent joined room
- `agent_message` - Agent sent a message
- `agent_left` - Agent left room
- `room_stats` - Room statistics update
- `deal_locked` - Deal agreed upon, verification started
- `deal_verifying` - Deal verification progress (with progress %)
- `deal_completed` - Deal executed successfully
- `message_batch` - Batch of high-frequency messages

See [WebSocket Event Documentation](docs/WEBSOCKET_EVENTS.md) for details.

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key tables:

- **users** - Web3 wallet users
- **nfts** - NFT metadata
- **rooms** - Trading rooms for collections
- **agents** - AI trading agents
- **swarms** - Agent groups for testing
- **deals** - Completed deals
- **messages** - Agent message summaries
- **agent_performance** - Agent metrics

See [Database Schema Documentation](docs/DATABASE_SCHEMA.md) for ERD and details.

## Deployment

See [Deployment Guide](docs/DEPLOYMENT.md) for production deployment instructions.

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check Docker is running
docker ps

# Restart PostgreSQL
docker-compose restart postgres
```

**Redis connection failed**
```bash
# Check Redis
docker-compose ps redis

# View Redis logs
docker-compose logs redis
```

**Rust service not responding**
```bash
# Check if running on port 8080
curl http://localhost:8080/health

# Rebuild and restart
cd rust-services && cargo run
```

**WebSocket not connecting**
- Check CORS_ALLOWED_ORIGINS includes your frontend URL
- Verify JWT token is valid
- Check browser console for errors

### Getting Help

- Check existing GitHub issues
- Review logs in `backend/logs/`
- Enable debug logging: `LOG_LEVEL=debug`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure typecheck and tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
