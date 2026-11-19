FROM node:22-alpine AS builder

WORKDIR /app

# Нативные зависимости (SQLite, bcrypt, sharp) нужны только на этапе сборки
RUN apk add --no-cache python3 make g++ gcc ffmpeg

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

# ffmpeg/wget/su-exec — runtime; компиляторы ставим временно только для npm ci
RUN apk add --no-cache ffmpeg wget su-exec

COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ gcc \
    && npm ci --omit=dev \
    && npm cache clean --force \
    && apk del .build-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/data \
    && chown -R node:node /app

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Entrypoint чинит владельца /app/data (старые тома были созданы от root) и понижает привилегии до node
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
