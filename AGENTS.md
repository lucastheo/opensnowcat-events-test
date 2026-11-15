# AGENTS.md

Orientation guide for AI agents working in this repository.

---

## 1. Documentation Index

All architectural designs and specifications live in [`docs/`](docs/):

- **Master Overview & Docker Compose:** [`docs/README.md`](docs/README.md)
- **Project Scope & Roadmap:** [`docs/project.md`](docs/project.md)
- **Module 1 (Test Bot):** [`docs/modules/test-bot.md`](docs/modules/test-bot.md)
- **Module 2 (Frontend Producer):** [`docs/modules/frontend-producer.md`](docs/modules/frontend-producer.md)
- **Module 3 (Backend Producer):** [`docs/modules/backend-producer.md`](docs/modules/backend-producer.md)
- **Module 4 (Simple Collector):** [`docs/modules/simple-collector.md`](docs/modules/simple-collector.md)
- **Container Standards:** [`docs/modules/docker.md`](docs/modules/docker.md)
- **Docker Compose Orchestration:** [`docs/modules/docker-compose.md`](docs/modules/docker-compose.md)
- **Contributing & Git Workflow:** [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## 2. Workspace Layout

Applications live in [`apps/`](apps/):
- `apps/test-bot/` — Playwright runner (CLI / port 6000)
- `apps/frontend-producer/` — React 19 + Vite app (port 3000)
- `apps/backend-producer/` — Next.js 15+ API service (port 4000)
- `apps/simple-collector/` — Fastify CSV logger (port 5000)
- `data/` — Host-mounted volume for `events.csv` output

---

## 3. Core Architectural Rules

1. **Runtime:** Node.js 26 across all apps with native ESM (`"type": "module"`).
2. **Frontend Delegation:** Frontend never computes service logic locally; delegates to Backend API. See [`frontend-producer.md`](docs/modules/frontend-producer.md#key-architectural-constraint).
3. **Backend 3-Tier Layering:** Controller (Zod DTOs) $\rightarrow$ Business (domain logic, `event_id`, timestamps) $\rightarrow$ External (HTTP clients). Controllers never call External. See [`backend-producer.md`](docs/modules/backend-producer.md#2-layered-architecture--dependency-rules).
4. **Dual Emission:** Every event sends tracking to OpenSnowcat (`/tp2`) and audit ping to Simple Collector (`POST /collect`).
5. **Simple Collector Persistence:** FIFO Promise Queue for sequential, append-only writes to `CSV_FILE_PATH`. See [`simple-collector.md`](docs/modules/simple-collector.md#2-architecture--sequential-append-flow).
6. **Dockerfiles Source of Truth:** `apps/<app>/Dockerfile` is the source of truth for each app's container build. Module specs describe it in prose and link to it; never paste the full Dockerfile into docs.
7. **Testing:** 1:1 unit tests for every source file. Integration tests mock **only** external network services.
8. **Documentation Updates:** Every code, architecture, or configuration change must update the corresponding specifications in [`docs/`](docs/). Never allow documentation drift; specs must remain accurate and synchronized with the codebase.
