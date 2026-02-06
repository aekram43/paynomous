#!/bin/bash
set -e

# Migration script for production database setup
# This script runs Prisma migrations on the production database

echo "======================================"
echo "Agentrooms Database Migration Script"
echo "======================================"
echo ""

# Load environment variables
if [ -f .env.production ]; then
    echo "Loading environment variables from .env.production..."
    export $(cat .env.production | grep -v '^#' | xargs)
elif [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: No .env or .env.production file found!"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set!"
    exit 1
fi

echo "Database URL: ${DATABASE_URL%%@*}@***"
echo ""

cd backend

echo "Step 1: Generating Prisma Client..."
npx prisma generate

echo ""
echo "Step 2: Running database migrations..."
npx prisma migrate deploy

echo ""
echo "Step 3: Seeding database (optional)..."
# Uncomment below to run seed script
# npx prisma db seed

echo ""
echo "======================================"
echo "Migration completed successfully!"
echo "======================================"
