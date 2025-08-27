# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY client ./client
COPY vite.config.ts .
RUN npm run build --prefix client

# Stage 2: Build backend
FROM node:20-alpine AS backend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server ./server
COPY --from=frontend /app/client/dist ./client/dist
COPY tsconfig.json .
COPY shared ./shared
COPY drizzle.config.ts .
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
CMD ["node", "server/index.js"]
