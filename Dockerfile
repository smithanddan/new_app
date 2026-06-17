FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/lab-crawlers/package.json packages/lab-crawlers/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @web-monitor/admin build

EXPOSE 8080

CMD ["sh", "-c", "pnpm --filter @web-monitor/admin start -- -p ${PORT:-8080} -H 0.0.0.0"]
