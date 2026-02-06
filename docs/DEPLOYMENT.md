# Agentrooms Deployment Guide

This guide covers deploying the Agentrooms platform to production using Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment Steps](#deployment-steps)
- [Health Checks](#health-checks)
- [Monitoring and Logs](#monitoring-and-logs)
- [Rolling Updates](#rolling-updates)
- [Troubleshooting](#troubleshooting)
- [Scaling Considerations](#scaling-considerations)

## Prerequisites

Before deploying to production, ensure you have:

- **Docker** 24.0+ and **Docker Compose** 2.20+ installed
- **Domain name** configured with DNS records
- **SSL/TLS certificates** (use Let's Encrypt or similar)
- **Production API keys** for:
  - GLM API (https://docs.z.ai/)
  - WalletConnect (https://cloud.walletconnect.com/)
  - ARK Network (or your chosen blockchain)

### Server Requirements

**Minimum specifications:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD

**Recommended specifications:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD

## Environment Configuration

### 1. Create Production Environment File

```bash
cp .env.production.example .env.production
```

### 2. Configure Required Variables

Edit `.env.production` and set these critical values:

```bash
# Generate secure secrets
openssl rand -base64 64  # Use this for JWT_SECRET

# Set strong passwords
POSTGRES_PASSWORD=your-secure-password-here

# Configure your domain
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Add production API keys
GLM_API_KEY=your-production-glm-key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

### 3. Security Checklist

- [ ] JWT_SECRET is 64+ random characters
- [ ] POSTGRES_PASSWORD is strong and unique
- [ ] CORS_ALLOWED_ORIGINS only includes your domains
- [ ] API keys are production-grade (not development keys)
- [ ] ARK_TESTNET_URL points to mainnet (for production)
- [ ] LOG_LEVEL is set to `info` or `warn`

## Deployment Steps

### 1. Build and Start Services

```bash
# Start all services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# View service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Run Database Migrations

```bash
# Run migration script
./scripts/migrate.sh

# Or manually
cd backend
npx prisma migrate deploy
```

### 3. Verify Deployment

```bash
# Check backend health
curl https://api.yourdomain.com/health

# Check frontend
curl https://yourdomain.com

# Check Rust service
curl http://localhost:8080/health  # Internal only
```

### 4. Configure Reverse Proxy (nginx)

Create an nginx configuration for SSL termination:

```nginx
# Frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## Health Checks

All services include Docker health checks:

```bash
# Check health status
docker-compose -f docker-compose.prod.yml ps

# Individual service health
docker inspect agentrooms-backend-prod | grep -A 10 Health
```

**Health endpoints:**
- Backend: `GET /health`
- Rust Service: `GET /health`
- Frontend: HTTP 200 on `/`

## Monitoring and Logs

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f rust-services

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Backend Application Logs

Backend logs are written to `backend/logs/`:
- `application-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only

Access via volume mount:
```bash
docker exec agentrooms-backend-prod ls -la /app/logs
docker exec agentrooms-backend-prod tail -f /app/logs/application-$(date +%Y-%m-%d).log
```

### Log Retention

- Application logs: 14 days
- Error logs: 30 days
- Docker logs: 3 files × 10MB max

## Rolling Updates

### Update Backend

```bash
# Pull latest code
git pull origin main

# Rebuild and restart backend only
docker-compose -f docker-compose.prod.yml up -d --build backend

# Run migrations if needed
./scripts/migrate.sh
```

### Update Frontend

```bash
# Rebuild and restart frontend only
docker-compose -f docker-compose.prod.yml up -d --build frontend
```

### Update Rust Services

```bash
# Rebuild and restart Rust services
docker-compose -f docker-compose.prod.yml up -d --build rust-services
```

### Full Update

```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Pull and rebuild
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
./scripts/migrate.sh
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource usage
docker stats

# Check disk space
df -h
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker-compose -f docker-compose.prod.yml logs postgres

# Check database connectivity
docker exec -it agentrooms-postgres-prod psql -U agentrooms -d agentrooms -c "SELECT 1;"
```

### Redis Connection Issues

```bash
# Verify Redis is running
docker-compose -f docker-compose.prod.yml logs redis

# Test Redis connection
docker exec -it agentrooms-redis-prod redis-cli ping
```

### High Memory Usage

```bash
# Check container resource usage
docker stats --no-stream

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Health Check Failing

```bash
# Manual health check
docker exec agentrooms-backend-prod wget -O- http://localhost:3000/health

# Check if port is accessible
netstat -tlnp | grep 3000
```

## Scaling Considerations

### Horizontal Scaling

For higher loads, you can run multiple backend instances:

```yaml
# In docker-compose.prod.yml
backend:
  deploy:
    replicas: 3  # Run 3 backend instances
```

**Important:** When scaling:
- Use a load balancer (nginx, HAProxy)
- Configure sticky sessions for WebSocket
- Use external Redis (not containerized)
- Use managed PostgreSQL (RDS, Cloud SQL)

### Database Scaling

- Add read replicas for analytics queries
- Use connection pooling (PgBouncer)
- Enable query caching
- Archive old deals periodically

### Redis Scaling

- Use Redis Cluster for high availability
- Enable Redis persistence (AOF + RDB)
- Monitor memory usage
- Use managed Redis (ElastiCache, Redis Cloud)

## Backup and Recovery

### Database Backup

```bash
# Backup PostgreSQL
docker exec agentrooms-postgres-prod pg_dump -U agentrooms agentrooms > backup.sql

# Restore PostgreSQL
docker exec -i agentrooms-postgres-prod psql -U agentrooms agentrooms < backup.sql
```

### Volume Backup

```bash
# Backup all volumes
docker run --rm \
  -v agentrooms_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Restore volume
docker run --rm \
  -v agentrooms_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

## Security Hardening

- [ ] Change all default passwords
- [ ] Enable firewall (ufw/iptables)
- [ ] Use HTTPS everywhere
- [ ] Implement rate limiting
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Enable fail2ban for brute force protection
- [ ] Regular vulnerability scanning

## Performance Tuning

### Backend

- Increase `connection_limit` in DATABASE_URL
- Tune BullMQ queue concurrency
- Enable response compression
- Use CDN for static assets

### Database

- Tune PostgreSQL `shared_buffers`
- Enable query caching
- Create indexes for hot queries
- Run `VACUUM ANALYZE` regularly

### Redis

- Tune `maxmemory` based on workload
- Use appropriate eviction policy
- Monitor key expiration
- Optimize data structures

## Support

For deployment issues:
1. Check logs first
2. Review troubleshooting section
3. Check GitHub issues
4. Contact support team
