FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY server/src ./src
COPY server/scripts ./scripts
COPY database /database

RUN chmod +x scripts/start.sh

ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/database/migrations
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1

CMD ["sh", "scripts/start.sh"]
