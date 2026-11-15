# Local OpenSnowcat Collector (`test/`)

This folder provides a local **OpenSnowcat Collector** on port `8080` so you can test the entire event pipeline locally (both with Docker and natively with Node.js).

## Files

- [`docker-compose.yml`](docker-compose.yml) — Runs the official `ghcr.io/opensnowcat/opensnowcat-collector-stdout:latest` container on port `8080`.
- [`config.hocon`](config.hocon) — OpenSnowcat HOCON configuration using the `stdout` sink and listening on `0.0.0.0:8080`.
- [`opensnowcat-server.mjs`](opensnowcat-server.mjs) — Zero-dependency Node.js OpenSnowcat Collector (`/com.snowplowanalytics.snowplow/tp2`, `/i`, `/health`, `/stats`, `/reset`) for running locally without Docker.

## Usage

### Option 1: Run via Root npm Scripts (No Docker Required)

```bash
# Start only the local OpenSnowcat collector on port 8080
npm run snowcat

# Start OpenSnowcat (:8080) + Simple Collector (:5000) + Backend (:4000) + Frontend (:3000)
npm run dev

# Run full E2E (starts OpenSnowcat + all 3 services + runs Test Bot)
npm run e2e -- --iterations 5 --concurrency 1
```

### Option 2: Run Official OpenSnowcat Container via Docker Compose

```bash
cd test
docker compose up
```

## Endpoints (`opensnowcat-server.mjs`)

- `POST http://localhost:8080/com.snowplowanalytics.snowplow/tp2` — Receives batched OpenSnowcat tracker payloads from Frontend and Backend producers.
- `GET http://localhost:8080/i` — Receives GET pixel tracking events.
- `GET http://localhost:8080/health` — Liveness probe (`200 OK`).
- `GET http://localhost:8080/stats` — Returns total received events, breakdown by `frontend-producer` vs `backend-producer`, and event metadata (`eid`, `e`, `aid`, `dtm`).
- `POST http://localhost:8080/reset` — Clears recorded in-memory events.
