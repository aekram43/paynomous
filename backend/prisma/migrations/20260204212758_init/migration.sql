-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_address" VARCHAR(42) NOT NULL,
    "nonce" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection" VARCHAR(50) NOT NULL,
    "token_id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "image_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "collection" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "swarm_id" UUID,
    "name" VARCHAR(50) NOT NULL,
    "avatar" VARCHAR(10),
    "role" VARCHAR(10) NOT NULL,
    "communication_style" VARCHAR(20) NOT NULL,
    "strategy" VARCHAR(20) NOT NULL,
    "nft_id" UUID,
    "min_price" DECIMAL(10,2),
    "max_price" DECIMAL(10,2),
    "starting_price" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'spawned',
    "deal_id" UUID,
    "messages_sent" INTEGER NOT NULL DEFAULT 0,
    "negotiation_time_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swarms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "preset" VARCHAR(30) NOT NULL,
    "total_agents" INTEGER NOT NULL,
    "buyers_count" INTEGER NOT NULL,
    "sellers_count" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "deals_completed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swarms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "buyer_agent_id" UUID NOT NULL,
    "seller_agent_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "nft_id" UUID NOT NULL,
    "final_price" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'locked',
    "tx_hash" VARCHAR(66),
    "block_number" BIGINT,
    "consensus_result" JSONB,
    "verified_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "message_type" VARCHAR(20) NOT NULL,
    "price_mentioned" DECIMAL(10,2),
    "sentiment" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_performance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "deals_completed" INTEGER NOT NULL DEFAULT 0,
    "avg_negotiation_time_seconds" INTEGER,
    "best_deal_percentage" DECIMAL(5,2),
    "messages_sent" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "users_wallet_address_idx" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "nfts_collection_token_id_idx" ON "nfts"("collection", "token_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfts_collection_token_id_key" ON "nfts"("collection", "token_id");

-- CreateIndex
CREATE INDEX "rooms_collection_status_idx" ON "rooms"("collection", "status");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_room_id_idx" ON "agents"("room_id");

-- CreateIndex
CREATE INDEX "agents_swarm_id_idx" ON "agents"("swarm_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "swarms_user_id_room_id_idx" ON "swarms"("user_id", "room_id");

-- CreateIndex
CREATE INDEX "swarms_status_idx" ON "swarms"("status");

-- CreateIndex
CREATE INDEX "deals_room_id_idx" ON "deals"("room_id");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_buyer_user_id_idx" ON "deals"("buyer_user_id");

-- CreateIndex
CREATE INDEX "deals_seller_user_id_idx" ON "deals"("seller_user_id");

-- CreateIndex
CREATE INDEX "deals_tx_hash_idx" ON "deals"("tx_hash");

-- CreateIndex
CREATE INDEX "messages_room_id_created_at_idx" ON "messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_agent_id_idx" ON "messages"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_performance_agent_id_key" ON "agent_performance"("agent_id");

-- CreateIndex
CREATE INDEX "agent_performance_agent_id_idx" ON "agent_performance"("agent_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_swarm_id_fkey" FOREIGN KEY ("swarm_id") REFERENCES "swarms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarms" ADD CONSTRAINT "swarms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swarms" ADD CONSTRAINT "swarms_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_agent_id_fkey" FOREIGN KEY ("buyer_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_agent_id_fkey" FOREIGN KEY ("seller_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_nft_id_fkey" FOREIGN KEY ("nft_id") REFERENCES "nfts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_performance" ADD CONSTRAINT "agent_performance_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
