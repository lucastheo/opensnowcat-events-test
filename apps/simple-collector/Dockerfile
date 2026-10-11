FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV CSV_FILE_PATH=/app/data/events.csv

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 5000

HEALTHCHECK --interval=5s --timeout=3s --retries=5 --start-period=3s \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "dist/index.js"]
