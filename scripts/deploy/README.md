# Reel AI Deployment Runbook

This runbook deploys Reel AI to Alibaba Cloud ECS with Docker Compose. Keep all secrets on the server; do not commit `.env` or screenshots that expose credentials.

## 1. Alibaba Cloud Resources

Create or identify these resources:

- ECS instance running a current Linux image with Docker and Docker Compose.
- Security group with inbound `80` and `443` from the public internet. Use temporary inbound `3000` only for a hackathon smoke test, then remove it after a reverse proxy is configured.
- Alibaba Cloud OSS bucket for uploads and generated artifacts.
- RDS PostgreSQL database if available. Docker Compose Postgres is acceptable for hackathon-only proof when RDS setup is not available in time.

Recommended production database:

```text
postgresql://<user>:<password>@<rds-host>:5432/reelai
```

Hackathon-only Docker database:

```text
postgresql://reelai:<strong-password>@postgres:5432/reelai
```

## 2. Server Environment

On the ECS instance, create `/opt/reelai/.env` from `.env.example` and fill real values:

```bash
sudo mkdir -p /opt/reelai
sudo cp .env.example /opt/reelai/.env
sudo editor /opt/reelai/.env
```

Required values:

- `DASHSCOPE_API_KEY`
- `QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- `DATABASE_URL`
- `OSS_REGION`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `PUBLIC_APP_URL`

Do not paste the `.env` file into chat, issue trackers, README files, or screenshots.

## 3. Build And Start

From the checked-out repository on ECS:

```bash
docker compose --env-file /opt/reelai/.env build web
docker compose --env-file /opt/reelai/.env --profile setup run --rm migrate
docker compose --env-file /opt/reelai/.env up -d web
```

If using Docker Postgres instead of RDS for hackathon proof, set a strong `POSTGRES_PASSWORD` and `DOCKER_DATABASE_URL` in `/opt/reelai/.env`, then start the database first:

```bash
docker compose --env-file /opt/reelai/.env up -d postgres
docker compose --env-file /opt/reelai/.env --profile setup run --rm migrate
docker compose --env-file /opt/reelai/.env up -d web
```

## 4. Verify The Deployment

Check containers:

```bash
docker compose --env-file /opt/reelai/.env ps
docker compose --env-file /opt/reelai/.env logs --tail=100 web
```

Run the deployed smoke test from your local machine or the server:

```bash
PLAYWRIGHT_BASE_URL=https://your-demo-domain.example \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
pnpm --filter web e2e
```

The smoke test creates a second project, registers a URL source, uploads a tiny image source, reloads, and verifies persistence.

## 5. Proof Package Checklist

Capture proof without exposing secrets:

- Browser screenshot or screen recording showing the public deployed URL and Reel AI studio.
- Alibaba Cloud ECS instance or Workbench screenshot showing the running server.
- Docker Compose `ps` output showing the `web` container healthy.
- OSS bucket screenshot showing generated artifact keys or folders, with access keys hidden.
- Optional RDS screenshot showing the PostgreSQL instance, with credentials hidden.
- After Phase 8 polish, one 1 to 3 minute demo video: intake, Brand Kit, concepts, storyboard, generation status, final render/download.

Store sensitive proof assets outside git or link to a public video/file host from the README judging section. Public-safe proof screenshots may live in `apps/web/public/` when they hide credentials.

## 6. Rollback

To stop the app:

```bash
docker compose --env-file /opt/reelai/.env down
```

If using Docker Postgres, do not delete the `postgres-data` volume unless you intentionally want to remove demo data.
