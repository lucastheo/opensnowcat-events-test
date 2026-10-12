# Multi-Service Docker Compose Orchestration (`docker-compose.md`)

## 1. Overview
This specification details the multi-container orchestration architecture for **`opensnowcat-events-test`**. All 4 application services (`simple-collector`, `backend-producer`, `frontend-producer`, `test-bot`) are coordinated on a shared Docker bridge network (`snowcat-net`) using health check dependency sequencing.

---

## 2. Container Network & Volume Topology

```mermaid
flowchart TD
    subgraph Host ["Host Machine"]
        HOST_DATA[("./data/events.csv (Mounted Volume)")]
    end

    subgraph DockerNetwork ["Docker Network: snowcat-net"]
        SC["simple-collector (Port 5000)\nFastify Service"]
        BP["backend-producer (Port 4000)\nNext.js API Service"]
        FP["frontend-producer (Port 3000)\nReact 19 / Nginx"]
        TB["test-bot (CLI Runner)\nPlaywright Engine"]
        OSC["opensnowcat (Port 8080)\nStream Collector"]
    end

    SC -->|"Writes rows to mounted volume"| HOST_DATA
    BP -->|"Audit: POST /collect"| SC
    BP -->|"Server Events: POST /tp2"| OSC
    FP -->|"Audit: POST /collect"| SC
    FP -->|"Browser Events: POST /tp2"| OSC
    FP -->|"API Requests: /api/*"| BP

    TB -->|"Browser UI Automation"| FP
    TB -->|"Direct API Calls"| BP

    style HOST_DATA fill:#f9f,stroke:#333,stroke-width:2px
```

---

## 3. `docker-compose.yml` Specification

```yaml
services:
  # ---------------------------------------------------------------------------
  # 1. Simple Collector (Ground-Truth CSV Logger)
  # ---------------------------------------------------------------------------
  simple-collector:
    build:
      context: ./apps/simple-collector
      dockerfile: Dockerfile
    container_name: simple-collector
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - HOST=0.0.0.0
      - CSV_FILE_PATH=/app/data/events.csv
      - CORS_ORIGIN=*
    volumes:
      # Mounts local ./data folder so events.csv persists directly on the host
      - ./data:/app/data
    networks:
      - snowcat-net
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/health"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 3s

  # ---------------------------------------------------------------------------
  # 2. Backend Producer (Next.js 15+ API Service)
  # ---------------------------------------------------------------------------
  backend-producer:
    build:
      context: ./apps/backend-producer
      dockerfile: Dockerfile
    container_name: backend-producer
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - CORS_ORIGIN=*
      - OPENSNOWCAT_COLLECTOR_URL=http://opensnowcat:8080
      - SIMPLE_COLLECTOR_URL=http://simple-collector:5000
    depends_on:
      simple-collector:
        condition: service_healthy
    networks:
      - snowcat-net
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/api/health"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s

  # ---------------------------------------------------------------------------
  # 3. Frontend Producer (React 19 + Vite Web Application)
  # ---------------------------------------------------------------------------
  frontend-producer:
    build:
      context: ./apps/frontend-producer
      dockerfile: Dockerfile
      args:
        - VITE_BACKEND_URL=http://localhost:4000
        - VITE_SIMPLE_COLLECTOR_URL=http://localhost:5000
        - VITE_OPENSNOWCAT_URL=http://localhost:8080
    container_name: frontend-producer
    ports:
      - "3000:3000"
    depends_on:
      backend-producer:
        condition: service_healthy
      simple-collector:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - snowcat-net

  # ---------------------------------------------------------------------------
  # 4. Test Bot (Automated Orchestration Runner)
  # ---------------------------------------------------------------------------
  test-bot:
    build:
      context: ./apps/test-bot
      dockerfile: Dockerfile
    container_name: test-bot
    environment:
      - FRONTEND_URL=http://frontend-producer:3000
      - BACKEND_URL=http://backend-producer:4000
      - SIMPLE_COLLECTOR_URL=http://simple-collector:5000
      - OPENSNOWCAT_URL=http://localhost:8080
      - ITERATIONS=100
      - CONCURRENCY=2
      - DELAY_MS=50
      - MODE=both
      - HEADLESS=true
    depends_on:
      frontend-producer:
        condition: service_healthy
      backend-producer:
        condition: service_healthy
      simple-collector:
        condition: service_healthy
    networks:
      - snowcat-net
    profiles:
      - full-test
      - bot

networks:
  snowcat-net:
    driver: bridge
```

---

## 4. Startup Sequencing & Health Checks

To prevent race conditions during startup:
1. **`simple-collector`** starts first and exposes `GET /health`.
2. **`backend-producer`** waits for `simple-collector` to report healthy before initializing its outbound HTTP clients.
3. **`frontend-producer`** waits for `backend-producer` to be healthy before accepting browser requests.
4. **`test-bot`** only launches once all services report healthy and are ready to receive load.

### 4.1 Container Network Routing & Request Rewriting
- **Host Browser vs Container Traffic:** The `frontend-producer` is compiled with browser-facing defaults (`VITE_BACKEND_URL=http://localhost:4000`, `VITE_SIMPLE_COLLECTOR_URL=http://localhost:5000`), allowing host browsers to communicate via exposed host ports (`3000`, `4000`, `5000`).
- **Containerized Playwright Execution:** When `test-bot` navigates to `http://frontend-producer:3000` from within `snowcat-net`, in-browser client calls to `localhost:*` would normally resolve to the `test-bot` container itself and fail.
- **Resolution Strategy:** Rather than requiring host networking (which is non-portable across Docker on Linux, macOS, and CI), the `test-bot` configures Playwright route interception (`context.route`) to dynamically rewrite in-page `http://localhost:4000` and `http://localhost:5000` requests to `BACKEND_URL` (`http://backend-producer:4000`) and `SIMPLE_COLLECTOR_URL` (`http://simple-collector:5000`).

---

## 5. Host Volume & Data Persistence

The Simple Collector mounts the host volume `./data` to `/app/data`:
- When the Test Bot executes, `events.csv` is written inside the container at `/app/data/events.csv`.
- This maps directly to `./data/events.csv` on the host machine.
- Stopping or removing containers (`docker compose down`) preserves the generated CSV on the host disk for downstream event loss analysis.

---

## 6. Execution Profiles & Commands

### 6.1 Manual Development / Browser Inspection
Starts `simple-collector`, `backend-producer`, and `frontend-producer`:
```bash
docker compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend API: `http://localhost:4000/api/health`
- Simple Collector: `http://localhost:5000/health`

### 6.2 Full Automated Test Run
Starts all services, waits for health checks, and triggers the Test Bot automatically:
```bash
docker compose --profile full-test up --build
```

### 6.3 On-Demand Bot Run with Custom Parameters
```bash
docker compose run --rm test-bot npx tsx src/index.ts \
  --frontend-url http://frontend-producer:3000 \
  --backend-url http://backend-producer:4000 \
  --iterations 500 \
  --concurrency 5 \
  --delay-ms 20
```

### 6.4 Teardown
```bash
docker compose down
```

---

## 7. Cross-Reference Links

- **Container Standards & Service Dockerfiles:** [`docker.md`](docker.md)
- **Module 1 (Test Bot):** [`test-bot.md`](test-bot.md)
- **Module 2 (Frontend Producer):** [`frontend-producer.md`](frontend-producer.md)
- **Module 3 (Backend Producer):** [`backend-producer.md`](backend-producer.md)
- **Module 4 (Simple Collector):** [`simple-collector.md`](simple-collector.md)
