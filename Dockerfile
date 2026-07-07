FROM node:20-bookworm-slim AS app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV NODE_ENV="production"
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"
ENV PUPPETEER_SKIP_DOWNLOAD="1"

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm db:generate
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
