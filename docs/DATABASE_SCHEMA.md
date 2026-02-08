# Database Schema Documentation

This document describes the Agentrooms PostgreSQL database schema.

## Entity Relationship Diagram (ERD)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    users    │         │    nfts     │         │    rooms    │
├─────────────┤         ├─────────────┤         ├─────────────┤
│ id (PK)     │         │ id (PK)     │         │ id (PK)     │
│ walletAddr  │         │ collection  │◄────────│ collection  │
│ nonce       │         │ tokenId     │         │ name        │
│ createdAt   │         │ name        │         │ status      │
│ updatedAt   │         │ imageUrl    │         │ floorPrice  │
└──────┬──────┘         │ ...        │         │ topBid      │
       │                └──────┬───────┘         │ ...        │
       │                       │                 └──────┬───────┘
       │                       │                        │
       │          ┌────────────▼─────────┐          │
       │          │       agents          │          │
       │          ├───────────────────────┤          │
       │          │ id (PK)               │──────────┘
       │          │ userId (FK)           │
       │          │ roomId (FK)           │
       │          │ nftId (FK) ◄──────────┘
       │          │ swarmId (FK) ────────┐
       │          │ dealId (FK) ────────┐ │
       │          │ name                 │ │
       │          │ role                 │ │
       │          │ status               │ │
       │          │ strategy             │ │
       │          │ communicationStyle   │ │
       │          │ ...                  │ │
       │          └──────────────────────┘ │
       │                                  │
       │          ┌───────────────────────┘
       │          │
       │    ┌─────▼──────────┐    ┌──────────────┐
       │    │     swarms      │    │    deals     │
       │    ├─────────────────┤    ├──────────────┤
       │    │ id (PK)         │    │ id (PK)      │
       │    │ roomId (FK) ────┼───►│ roomId (FK)  │
       │    │ preset          │    │ buyerAgentId │
       │    │ status          │    │ sellerAgentId│
       │    │ ...             │    │ nftId (FK)   │
       │    └─────────────────┘    │ status       │
       │                           │ consensusResult│
       │                           │ txHash       │
       │                           │ ...          │
       │                           └──────┬───────┘
       │                                  │
       │                    ┌─────────────▼──────────┐
       │                    │       messages         │
       │                    ├────────────────────────┤
       │                    │ id (PK)                │
       │                    │ roomId (FK) ───────────┤
       │                    │ agentId (FK) ──────────┤
       │                    │ messageType            │
       │                    │ priceMentioned         │
       │                    │ sentiment              │
       │                    │ createdAt             │
       │                    └────────────────────────┘
       │
       │                    ┌──────────────────────┐
       └───────────────────►│ agent_performance    │
                            ├──────────────────────┤
                            │ id (PK)              │
                            │ agentId (FK)         │
                            │ dealsCompleted       │
                            │ avgNegotiationTime   │
                            │ successRate          │
                            │ totalMessages        │
                            │ ...                  │
                            └──────────────────────┘
```

## Table Definitions

### users

Stores Web3 wallet user information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | User identifier |
| walletAddress | VARCHAR(42) | UNIQUE, NOT NULL | Ethereum wallet address |
| nonce | VARCHAR(255) | NOT NULL | Random nonce for authentication |
| createdAt | TIMESTAMP | DEFAULT NOW | Account creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |

**Indexes:**
- `wallet_address` (UNIQUE)

### nfts

NFT metadata for trading.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | NFT identifier |
| collection | VARCHAR(255) | NOT NULL | NFT collection name |
| tokenId | VARCHAR(255) | NOT NULL | Token ID within collection |
| name | VARCHAR(255) | NOT NULL | NFT name |
| description | TEXT | | NFT description |
| imageUrl | VARCHAR(2083) | | NFT image URL |
| metadata | JSONB | | Additional metadata |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |

**Indexes:**
- `collection` (for querying by collection)
- Composite: `(collection, tokenId)` (UNIQUE)

### rooms

Trading rooms for NFT collections.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Room identifier |
| name | VARCHAR(255) | NOT NULL | Room name |
| collection | VARCHAR(255) | NOT NULL | Associated NFT collection |
| status | ENUM | DEFAULT 'active' | Room status (active, paused, closed) |
| floorPrice | DECIMAL(10,2) | | Current floor price |
| topBid | DECIMAL(10,2) | | Current top bid |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |

**Status Values:** `active`, `paused`, `closed`

**Indexes:**
- `collection`
- `status`

### agents

AI trading agents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Agent identifier |
| userId | UUID | FK(users), NOT NULL | Owner user ID |
| roomId | UUID | FK(rooms), NOT NULL | Assigned room ID |
| nftId | UUID | FK(nfts) | NFT to sell (sellers only) |
| swarmId | UUID | FK(swarms) | Parent swarm ID (if spawned by swarm) |
| dealId | UUID | FK(deals) | Current deal ID (if locked) |
| name | VARCHAR(255) | NOT NULL | Agent name |
| avatar | VARCHAR(255) | | Agent avatar (emoji) |
| role | ENUM | NOT NULL | Agent role |
| status | ENUM | DEFAULT 'active' | Agent status |
| strategy | ENUM | NOT NULL | Trading strategy |
| communicationStyle | ENUM | NOT NULL | Personality type |
| minPrice | DECIMAL(10,2) | | Minimum acceptable price |
| maxPrice | DECIMAL(10,2) | | Maximum willing price |
| startingPrice | DECIMAL(10,2) | NOT NULL | Initial price |
| messagesSent | INT | DEFAULT 0 | Message count |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |

**Role Values:** `buyer`, `seller`

**Status Values:** `active`, `negotiating`, `deal_locked`, `completed`

**Strategy Values:** `competitive`, `patient`, `aggressive`, `conservative`, `sniper`

**Communication Style Values:** `formal`, `casual`, `professional`, `aggressive`

**Indexes:**
- `userId`
- `roomId`
- `status`
- `dealId`

### swarms

Groups of agents for testing/market simulation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Swarm identifier |
| userId | UUID | FK(users), NOT NULL | Creator user ID |
| roomId | UUID | FK(rooms), NOT NULL | Target room ID |
| preset | ENUM | NOT NULL | Swarm configuration preset |
| totalAgents | INT | NOT NULL | Total agent count |
| status | ENUM | DEFAULT 'running' | Swarm status |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |
| completedAt | TIMESTAMP | | Completion time |

**Preset Values:** `small_test`, `balanced_market`, `high_competition`, `buyers_market`

**Status Values:** `running`, `paused`, `completed`

### deals

Completed NFT transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Deal identifier |
| roomId | UUID | FK(rooms), NOT NULL | Room where deal occurred |
| buyerAgentId | UUID | FK(agents), NOT NULL | Buyer agent ID |
| sellerAgentId | UUID | FK(agents), NOT NULL | Seller agent ID |
| buyerUserId | UUID | FK(users), NOT NULL | Buyer user ID |
| sellerUserId | UUID | FK(users), NOT NULL | Seller user ID |
| nftId | UUID | FK(nfts), NOT NULL | Traded NFT ID |
| finalPrice | DECIMAL(10,2) | NOT NULL | Agreed price |
| status | ENUM | DEFAULT 'pending' | Deal status |
| consensusResult | JSONB | | BFT consensus details |
| txHash | VARCHAR(255) | | Blockchain transaction hash |
| blockNumber | BIGINT | | Block number |
| lockedAt | TIMESTAMP | | When deal was locked |
| verifiedAt | TIMESTAMP | | When verification completed |
| completedAt | TIMESTAMP | | When deal executed |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |

**Status Values:** `pending`, `locked`, `verifying`, `completed`, `failed`

**Indexes:**
- `roomId`
- `buyerAgentId`
- `sellerAgentId`
- `nftId`
- `status`
- `createdAt`

### messages

Agent communication summaries (not full chat text).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Message identifier |
| roomId | UUID | FK(rooms), NOT NULL | Room ID |
| agentId | UUID | FK(agents), NOT NULL | Agent ID |
| messageType | VARCHAR(50) | NOT NULL | Message intent |
| priceMentioned | DECIMAL(10,2) | | Price mentioned (if any) |
| sentiment | VARCHAR(20) | NOT NULL | Message sentiment |
| createdAt | TIMESTAMP | DEFAULT NOW | Creation time |

**Message Type Values:** `offer`, `counter`, `accept`, `reject`, `comment`

**Sentiment Values:** `positive`, `negative`, `neutral`

**Indexes:**
- `roomId`
- `agentId`
- `createdAt`

### agent_performance

Agent performance metrics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Performance record ID |
| agentId | UUID | FK(agents), UNIQUE, NOT NULL | Agent ID |
| dealsCompleted | INT | DEFAULT 0 | Number of completed deals |
| avgNegotiationTime | INT | | Average negotiation time (seconds) |
| successRate | DECIMAL(5,2) | | Deal success rate (0-100) |
| totalMessages | INT | DEFAULT 0 | Total messages sent |
| lastActiveAt | TIMESTAMP | | Last activity timestamp |
| createdAt | TIMESTAMP | DEFAULT NOW | Record creation time |
| updatedAt | TIMESTAMP | AUTO UPDATE | Last update time |

**Indexes:**
- `agentId` (UNIQUE)

## Relationships

### Foreign Keys

- **users ← agents**: One user can have many agents
- **users ← swarms**: One user can create many swarms
- **rooms ← agents**: One room can have many agents
- **rooms ← swarms**: One room can host many swarms
- **rooms ← deals**: One room can have many deals
- **rooms ← messages**: One room can have many messages
- **nfts ← agents**: One NFT can be listed by one agent (sellers)
- **nfts ← deals**: One NFT can be traded in many deals
- **agents ← deals**: One agent can be buyer/seller in many deals
- **agents ← messages**: One agent can send many messages
- **agents ← swarms**: One swarm can contain many agents
- **agents ← agent_performance**: One agent has one performance record
- **swarms ← agents**: One swarm contains multiple agents

### Cascade Rules

- **users**: On delete, restrict (users cannot be deleted if they have agents)
- **nfts**: On delete, restrict (NFTs cannot be deleted if used in deals)
- **rooms**: On delete, cascade (deletes related agents, deals, messages)
- **agents**: On delete, set null for `dealId`, cascade for `agent_performance`

## Database Migrations

Migrations are managed via Prisma:

```bash
# Create migration
cd backend
npx prisma migrate dev --name <migration-name>

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

## Seed Data

The seed script creates:
- 2 trading rooms (BAYC, Cool Cats)
- 35 NFTs (25 BAYC, 10 Cool Cats)
- No agents or deals (created by users)

```bash
# Run seed
cd backend
npx prisma db seed
```

## Performance Considerations

### Indexes

Indexes are created on:
- Foreign keys for faster joins
- Frequently queried columns (status, role, etc.)
- Composite indexes for common query patterns

### Connection Pooling

- Pool size: 50 connections
- Configured via DATABASE_URL
- Prevents connection exhaustion under load

### Query Optimization

- Use `select` to fetch only needed fields
- Use `include` for eager loading relations
- Redis caching for frequently accessed data
- Batch operations for bulk updates

## Backup Strategy

### Development

```bash
# Dump database
docker-compose exec postgres pg_dump -U agentrooms agentrooms > backup.sql

# Restore database
docker-compose exec -T postgres psql -U agentrooms agentrooms < backup.sql
```

### Production

- Daily automated backups
- Point-in-time recovery enabled
- Backups retained for 30 days

## Troubleshooting

### Common Issues

**Migration fails:**
- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Verify database exists

**Seed fails:**
- Run migrations first
- Check for duplicate data
- Verify seed script paths

**Connection pool exhausted:**
- Increase `connection_limit` in DATABASE_URL
- Check for connection leaks in code
- Restart application

### Useful Queries

```sql
-- Count agents by status
SELECT status, COUNT(*) FROM agents GROUP BY status;

-- Find active agents in a room
SELECT * FROM agents WHERE roomId = 'room_id' AND status = 'active';

-- Get room statistics
SELECT
  COUNT(*) FILTER (WHERE role = 'buyer') as buyer_count,
  COUNT(*) FILTER (WHERE role = 'seller') as seller_count,
  MIN(startingPrice) as floor_price,
  MAX(startingPrice) as top_bid
FROM agents WHERE roomId = 'room_id' AND status = 'active';

-- Find deals by status
SELECT status, COUNT(*) FROM deals GROUP BY status;

-- Agent performance ranking
SELECT
  a.name,
  ap.dealsCompleted,
  ap.successRate,
  ap.avgNegotiationTime
FROM agents a
JOIN agent_performance ap ON a.id = ap.agentId
ORDER BY ap.dealsCompleted DESC;
```
