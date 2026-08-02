FROM node:22-alpine AS builder

WORKDIR /app

# Install native dependencies for SQLite
RUN apk add --no-cache python3 make g++ gcc ffmpeg

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

# Enable native SQLite support + healthcheck
RUN apk add --no-cache python3 make g++ gcc ffmpeg wget

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Using tsx or node depending on build outputs. For Express+Vite compiled properly via esbuild:
CMD ["npm", "start"]
