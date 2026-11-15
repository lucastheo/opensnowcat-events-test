# Docker & Container Standards

## 1. Overview
Each application in the `apps/` directory maintains its own isolated `Dockerfile` tailored to its runtime requirements. Multi-service orchestration is handled by the root `docker-compose.yml`, documented in [docker-compose.md](docker-compose.md).

---

## 2. Service Dockerfiles Reference

Each `Dockerfile` in `apps/*/` is the source of truth for its container build. Module docs describe the build in prose and link to the file instead of duplicating it:

| Service | Runtime & Base Image | Dockerfile |
|---|---|---|
| **Simple Collector** | Fastify HTTP audit service (`node:26-alpine`) | [`apps/simple-collector/Dockerfile`](../../apps/simple-collector/Dockerfile) |
| **Backend Producer** | Next.js 15+ standalone API service (`node:26-alpine`) | [`apps/backend-producer/Dockerfile`](../../apps/backend-producer/Dockerfile) |
| **Frontend Producer** | React 19 + Vite served via Nginx (`nginx:alpine`) | [`apps/frontend-producer/Dockerfile`](../../apps/frontend-producer/Dockerfile) |
| **Test Bot** | Playwright headless browser runner (`mcr.microsoft.com/playwright`) | [`apps/test-bot/Dockerfile`](../../apps/test-bot/Dockerfile) |

---

## 3. Container Standards & Security Guidelines

1. **Non-Root Execution:** Node-based runtime containers execute under the unprivileged `node` user (UID 1000).
2. **Deterministic Installs:** Build stages use `npm ci` rather than `npm install` for reproducible dependency trees.
3. **Multi-Stage Builds:** Development dependencies (`devDependencies`) and intermediate build artifacts are discarded from production runtime images.
4. **Health Checks:** Services declare HTTP healthcheck probes (`wget`) enabling Docker Compose to coordinate startup dependencies reliably.
