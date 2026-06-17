<!--
  Copyright (c) 2026 zouyc zouyccq@gmail.com.
  All rights reserved.

  Licensed under the Business Source License 1.1 (BSL 1.1).
  You may not use this file except in compliance with the License.

  Change Date: 2031-01-01
  On the Change Date, or the fourth anniversary of the first publicly available
  distribution of the code under the BSL, whichever comes first, the code
  automatically becomes available under the Apache License 2.0.
-->

**English** | [简体中文](./production-deployment.zh.md)

# X-Market Production Deployment (Ubuntu Backend + Vercel Frontend)

> **Backend:** Ubuntu 24.04 LTS · Docker Compose · optional Nginx + TLS  
> **Frontend:** Vercel (Next.js 15, `app/` directory)  
> **On-chain config:** [deploy/testnet-v2.json](../deploy/testnet-v2.json)

For local/test deployment see [testnet-deployment-ubuntu.md](./testnet-deployment-ubuntu.md).

---

## Quick start

### Backend — Docker (recommended)

```bash
export XMARKET_DEPLOYER_PRIVATE_KEY='suiprivkey1...'

./scripts/deploy-backend-ubuntu-docker.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --api-domain api.example.com \
  --profile p2 \
  --install-deps \
  --setup-nginx \
  --setup-ssl \
  --ssl-email ops@example.com
```

### Backend — Native (no Docker for app services)

```bash
./scripts/deploy-backend-ubuntu-native.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --profile p2 \
  --postgres-mode docker \
  --setup-systemd
```

Or use `./scripts/deploy-backend-ubuntu.sh --mode docker|native ...`

### Frontend (Vercel)

```bash
./scripts/deploy-frontend-vercel.sh \
  --frontend-url https://x-market.vercel.app \
  --api-base-url https://api.example.com \
  --profile p2 \
  --prod
```

Set Vercel project **Root Directory** to `app`.

Full guide: [production-deployment.zh.md](./production-deployment.zh.md) (Chinese, complete).

---

## Scripts

| Script | Description |
|--------|-------------|
| `deploy-backend-ubuntu.sh` | Entry point (`--mode docker\|native`) |
| `deploy-backend-ubuntu-docker.sh` | Docker Compose backend deploy |
| `deploy-backend-ubuntu-native.sh` | Native Node.js backend deploy |
| `stop-backend-production.sh` | Stop production backend |
| `deploy-frontend-vercel.sh` | One-click Vercel frontend deploy |
| `bootstrap-production-env.sh` | Generate production env files |
| `setup-nginx-api.sh` | Nginx reverse proxy + optional certbot |
| `docker-compose.production.yml` | Production Docker Compose stack |
