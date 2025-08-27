# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates && \
    rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY SnarkySage/package.json SnarkySage/package-lock.json ./SnarkySage/
RUN cd SnarkySage && npm ci --omit=dev

FROM base AS build
WORKDIR /app
COPY SnarkySage ./SnarkySage
RUN cd SnarkySage && npm ci && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# App expects dist and node_modules at /app
COPY --from=deps /app/SnarkySage/node_modules ./node_modules
COPY --from=build /app/SnarkySage/dist ./dist

EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/index.js"]
