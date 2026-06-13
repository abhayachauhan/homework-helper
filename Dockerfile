# syntax=docker/dockerfile:1

# ---- 1) Build the web SPA (Vite) ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build            # -> /web/dist

# ---- 2) Build the api (tsc) ----
FROM node:20-slim AS api-build
WORKDIR /api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build            # -> /api/dist

# ---- 3) Runtime ----
FROM node:20-slim AS runtime
# Toolchain so `npm ci` can compile better-sqlite3 + sharp native bindings.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Production deps only, compiled for this image, under /app/api.
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
# The Agent SDK authenticates through the claude CLI's OAuth creds (~/.claude).
RUN npm i -g @anthropic-ai/claude-code
# Built api + the static SPA, positioned so ../../web/dist resolves from /app/api/dist.
COPY --from=api-build /api/dist ./dist
COPY --from=web /web/dist /app/web/dist
# Data dir for the SQLite bind mount; run unprivileged.
RUN mkdir -p /app/data && chown -R node:node /app
WORKDIR /app
USER node
ENV PORT=8080 HH_DB_PATH=/app/data/homework.db
EXPOSE 8080
CMD ["node", "api/dist/index.js"]
