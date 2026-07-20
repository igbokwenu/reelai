# Reel AI Deployment Runbook

This runbook documents the current preliminary hackathon deployment: one Reel AI instance on Alibaba Cloud ECS using the existing Docker Compose file. It is suitable for a controlled demo, not an unrestricted production service.

Reel AI currently has no application login or tenant isolation. Protect a public deployment with a reverse-proxy login or an IP allowlist, and do not accept confidential uploads.

## 1. Alibaba Cloud Resources

Create or identify:

- A Linux ECS instance with Git, Docker Engine, and the Docker Compose plugin.
- A security group allowing `80` and `443`. Allow `22` only from a trusted IP if SSH is used. Port `3000` should be temporary for direct demo testing, and PostgreSQL port `5432` should not be public.
- An Alibaba Cloud Model Studio/QwenCloud API key. The key and configured Qwen endpoints must belong to the same region.
- An OSS bucket for generated demo artifacts.
- Optionally, ApsaraDB RDS for PostgreSQL. The bundled Compose PostgreSQL service is the simplest reproducible hackathon setup.

Prefer ECS, OSS, and RDS in the same region and VPC. Use the RDS private endpoint and allow only the ECS private IP when RDS is selected.

References: [ECS instance setup](https://www.alibabacloud.com/help/en/ecs/user-guide/create-an-instance-by-using-the-wizard), [security groups](https://www.alibabacloud.com/help/en/ecs/user-guide/start-using-security-groups), [Model Studio API keys](https://www.alibabacloud.com/help/en/model-studio/get-api-key), and [RDS PostgreSQL networking](https://www.alibabacloud.com/help/en/rds/apsaradb-rds-for-postgresql/connections-and-networks/).

## 2. OSS and RAM Setup

Do not use an AccessKey belonging to the Alibaba Cloud account. Create a dedicated programmatic RAM user for Reel AI with no console login and attach a bucket-scoped custom policy. The current code signs only uploads and deletes; public reads do not use the RAM identity. Replace `YOUR_BUCKET`:

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:DeleteObject"],
      "Resource": "acs:oss:*:*:YOUR_BUCKET/projects/*"
    }
  ]
}
```

The current prototype stores the normal OSS object URL and later reads it without signing the download. Use a dedicated demo bucket with the `public-read` ACL—never `public-read-write`—and never place confidential uploads in it. Alibaba Cloud's Block Public Access setting overrides public ACLs, so it must not be enabled for this dedicated bucket while using the current implementation. Private OSS downloads are future hardening work.

Set `OSS_REGION` to the endpoint prefix used by the code, for example `oss-ap-southeast-1`, rather than only `ap-southeast-1`. The current implementation constructs the standard public OSS endpoint and does not support a custom OSS CNAME; Singapore is the simplest pairing with the repository's default international Model Studio endpoint. See [RAM security best practices](https://www.alibabacloud.com/help/en/ram/product-overview/best-practices-for-identity-and-access-control), [OSS RAM policies](https://www.alibabacloud.com/help/en/oss/user-guide/ram-policy/), and [OSS access control](https://www.alibabacloud.com/help/en/oss/user-guide/permissions-and-access-control-overview).

## 3. Clone and Configure

Clone your fork on ECS, then create a server-only environment file:

```bash
sudo mkdir -p /opt/reelai
sudo chown "$USER":"$(id -gn)" /opt/reelai
git clone https://github.com/YOUR-USER/reelai.git /opt/reelai/app
cd /opt/reelai/app
cp .env.example /opt/reelai/.env
chmod 600 /opt/reelai/.env
editor /opt/reelai/.env
```

Set these values:

```dotenv
DASHSCOPE_API_KEY=your-model-studio-api-key
PUBLIC_APP_URL=https://your-demo-domain.example

# Caddy gateway. Use http://PUBLIC_IP when no domain is available, or use an
# HTTPS hostname to let Caddy obtain and renew its certificate automatically.
REELAI_SITE_ADDRESS=https://your-demo-domain.example
REELAI_BASIC_AUTH_USER=your-private-judge-username
REELAI_BASIC_AUTH_HASH='$2a$14$replace-with-a-caddy-generated-hash'

OSS_REGION=oss-ap-southeast-1
OSS_BUCKET=your-demo-bucket
OSS_ACCESS_KEY_ID=your-dedicated-ram-access-key-id
OSS_ACCESS_KEY_SECRET=your-dedicated-ram-access-key-secret
```

For the bundled PostgreSQL container, also set a strong password and a matching container URL. URL-encode special characters in the URL password:

```dotenv
POSTGRES_USER=reelai
POSTGRES_PASSWORD=choose-a-strong-password
DOCKER_DATABASE_URL=postgresql://reelai:the-same-url-encoded-password@postgres:5432/reelai
DATABASE_URL=postgresql://reelai:the-same-url-encoded-password@localhost:5432/reelai
```

For RDS, set both database variables to the RDS private endpoint URL. The current Compose topology still starts its PostgreSQL dependency even when the application URL points to RDS; this is a known prototype limitation.

Do not paste the environment file into chat, issues, logs, or screenshots.

Generate the password hash interactively so the plaintext password does not
enter shell history:

```bash
docker run --rm -it caddy:2.11.4-alpine caddy hash-password
```

Store only the resulting hash in `REELAI_BASIC_AUTH_HASH`. Send the plaintext
username and password to judges privately. Caddy protects the UI and every
generation endpoint. Only read-only artifact file endpoints bypass the prompt
because the render pipeline must fetch them; those endpoints cannot spend
QwenCloud credits.

## 4. Build and Start

The existing Compose file uses `REELAI_ENV_FILE` to select the file loaded into containers. `--env-file` separately supplies values used while Compose evaluates the file, so use both:

```bash
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env build web
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env up -d postgres
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env --profile setup run --rm migrate
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env up -d gateway
```

The migration service applies production migrations and seeds the two demo projects. It is explicit and is not run automatically when the web container starts.

## 5. Verify

```bash
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env ps
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env logs --tail=100 web
```

The gateway should reject an unauthenticated request and accept the private
judge credentials:

```bash
curl --head "${PUBLIC_APP_URL}"
curl --fail --silent --show-error --user "${REELAI_BASIC_AUTH_USER}" "${PUBLIC_APP_URL}"
```

The first command should return `401`; the second should return the app HTML.
Keep only ports `80` and `443` open for the gateway, restrict SSH to your IP,
and do not expose ports `3000` or `5432` in the ECS security group.

The Playwright smoke suite modifies data. Run it only against a disposable demo database:

```bash
PLAYWRIGHT_BASE_URL=https://your-demo-domain.example \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
pnpm --filter web e2e
```

## Troubleshooting

- Docker build fails during `pnpm install` with slow-download warnings, error `23`, `UND_ERR_SOCKET`, or a timeout: this is a registry/network download failure, not a Next.js compilation error. Retry the build and check ECS/Docker DNS, proxy, bandwidth, and access to `registry.npmjs.org`.
- `P1001` or database timeout: verify `DOCKER_DATABASE_URL`. The bundled container hostname is `postgres`, not `localhost`.
- OSS upload or read fails: verify the endpoint-style `OSS_REGION`, bucket, RAM credentials/policy, and the prototype's public-read requirement.
- Model Studio returns `401` or `403`: verify the key, region, endpoint, model access, and quota.

## Stop or Roll Back

```bash
REELAI_ENV_FILE=/opt/reelai/.env docker compose --env-file /opt/reelai/.env down
```

Do not add `--volumes` unless you intentionally want to delete the bundled PostgreSQL and local artifact volumes. Database migrations are forward changes; back up data before updating the deployed commit.
