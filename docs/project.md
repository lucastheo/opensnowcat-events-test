# Project Specification & Roadmap (`project.md`)

## 1. Overview & Problem Statement

### 1.1 Context
[OpenSnowcat](https://github.com/opensnowcat) is an open-source behavioral data pipeline designed to collect, enrich, and process user behavioral event data. Events are emitted from frontend (web/mobile) and backend (server-side) sources to an OpenSnowcat stream collector.

### 1.2 The Problem
When modifying or testing the infrastructure (e.g., scaling services, tuning configurations, updating network routing, or modifying collector nodes), there is currently no simple way to verify if all events are received or if events are being lost.

### 1.3 Solution Scope & Boundaries
This tool provides an automated testing system that:
1. Uses an automated **Test Bot** to control the **Frontend** (driving user/browser actions) and make direct requests to the **Backend** (API calls).
2. The **Frontend** and **Backend** emit behavioral events to the **OpenSnowcat Collector**.
3. On each iteration, both producers notify a lightweight **Simple Collector** with just the **`event_id`** and **`timestamp`**.
4. The **Simple Collector** generates a local **CSV** (`events.csv`).

*The scope of this tool finishes once the Bot completes its run and all emitted `(event_id, timestamp)` records are written to `events.csv`.* With this generated CSV of sent events, you have a definitive ground truth that you can compare against wherever events land in your infrastructure to verify that no events were lost.

---

## 2. Goals & Key Objectives

1. **Automated Test Bot (Driver / Orchestrator):**
   - Controls the **Frontend** (automating UI interactions such as navigation, clicks, and page views).
   - Makes direct HTTP requests to the **Backend** API.

2. **Synthetic Multi-Source Event Generation:**
   - **Frontend:** Generates client-side OpenSnowcat events triggered by the Bot's UI interactions.
   - **Backend:** Generates server-side OpenSnowcat events triggered by the Bot's direct API requests.

3. **Simple Collector & CSV Generation:**
   - A lightweight service (`Simple Collector`) that exposes an endpoint (`POST /collect`) to receive `event_id`, `timestamp`, and `source`.
   - On each event generation, Frontend and Backend notify the Simple Collector.
   - The Simple Collector appends the records directly to a local CSV file.

---

## 3. Development Phases & Roadmap

### Phase 1: Simple Collector Service
- [ ] Create the lightweight HTTP server (`Simple Collector`) with `POST /collect` using Fastify on Node.js 26.
- [ ] Implement sequential FIFO Promise queue CSV writer that safely appends records (`event_id, timestamp, source, event_type`).
- [ ] Write 1:1 unit tests and Fastify inject integration tests.

### Phase 2: Backend Producer
- [ ] Implement 3-tier Next.js 15+ API service (Controller $\rightarrow$ Business $\rightarrow$ External).
- [ ] Implement domain logic for 4 services: Calculator, Location Timestamp, Daily Excuse, Dice Emulator.
- [ ] Emits OpenSnowcat server tracking events (`/tp2`) and Simple Collector audit pings (`POST /collect`).
- [ ] Write 1:1 unit tests and integration tests mocking only external services.

### Phase 3: Frontend Producer
- [ ] Implement React 19 + Vite web application with 5 pages (`/`, `/calc`, `/timestamp`, `/excuse`, `/dice`).
- [ ] Enforce backend delegation (no local calculation in the browser).
- [ ] Integrate OpenSnowcat JS tracker (`trackPageView`, `trackStructEvent`, `trackSelfDescribingEvent`) and Simple Collector audit reporter.
- [ ] Write Vitest component and delegation tests.

### Phase 4: Test Bot (Driver / Orchestrator)
- [ ] Implement Playwright headless browser automation driving the 5 frontend pages.
- [ ] Implement direct HTTP API client issuing batched requests to Backend Producer.
- [ ] Configurable test loops (iterations, concurrency, pacing via CLI flags).
- [ ] Write unit tests and integration tests with mock targets.

### Phase 5: Packaging & Orchestration
- [ ] Dedicated Dockerfiles for each application (`apps/*/Dockerfile`).
- [ ] Root `docker-compose.yml` to orchestrate multi-service execution on a shared bridge network.
- [ ] End-to-end execution profile with health checks and volume persistence to host `./data/events.csv`.

---

## 4. References & Technical Specifications

For full architectural diagrams, component contracts, and deployment specifications, consult:

- **System Architecture & Docker Orchestration:** [`docs/README.md`](README.md)
- **Module 1 (Test Bot):** [`docs/modules/test-bot.md`](modules/test-bot.md)
- **Module 2 (Frontend Producer):** [`docs/modules/frontend-producer.md`](modules/frontend-producer.md)
- **Module 3 (Backend Producer):** [`docs/modules/backend-producer.md`](modules/backend-producer.md)
- **Module 4 (Simple Collector):** [`docs/modules/simple-collector.md`](modules/simple-collector.md)
- **Container Standards:** [`docs/modules/docker.md`](modules/docker.md)
