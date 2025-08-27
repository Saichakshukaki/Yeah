# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm for faster installs (optional)
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY . .
# Install dev deps for build
RUN npm ci
# Build client and server bundle into dist/
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy production node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
# Copy built app
COPY --from=build /app/dist ./dist
# Ensure static assets exist inside dist/public (built by vite)

EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]
