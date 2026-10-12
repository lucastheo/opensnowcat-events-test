FROM mcr.microsoft.com/playwright:v1.49.0-noble AS runner
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src

ENV FRONTEND_URL=http://frontend-producer:3000
ENV BACKEND_URL=http://backend-producer:4000
ENV SIMPLE_COLLECTOR_URL=http://simple-collector:5000
ENV OPENSNOWCAT_URL=http://localhost:8080
ENV ITERATIONS=100
ENV CONCURRENCY=2
ENV DELAY_MS=50
ENV MODE=both
ENV HEADLESS=true

CMD ["npx", "tsx", "src/index.ts"]
