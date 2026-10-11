# Docker & Container Standards

## 1. Overview
Each application in the `apps/` directory maintains its own isolated `Dockerfile` tailored to its runtime requirements. Multi-service orchestration is handled by the root `docker-compose.yml`, documented in [docs/README.md](../README.md#6-multi-service-docker-orchestration-docker-composeyml).

---

## 2. Service Dockerfiles Reference

The Dockerfile for each service is specified directly in its referent module documentation:

| Service | Runtime & Base Image | Specification Link |
|---|---|---|
| **Simple Collector** | Fastify HTTP audit service (`node:26-alpine`) | [`apps/simple-collector/Dockerfile`](simple-collector.md#77-dockerfile-specification-appssimple-collectordockerfile) |
| **Backend Producer** | Next.js 15+ standalone API service (`node:26-alpine`) | [`apps/backend-producer/Dockerfile`](backend-producer.md#73-dockerfile-specification-appsbackend-producerdockerfile) |
| **Frontend Producer** | React 19 + Vite served via Nginx (`nginx:alpine`) | [`apps/frontend-producer/Dockerfile`](frontend-producer.md#32-dockerfile-specification-appsfrontend-producerdockerfile) |
| **Test Bot** | Playwright headless browser runner (`mcr.microsoft.com/playwright`) | [`apps/test-bot/Dockerfile`](test-bot.md#32-dockerfile-specification-appstest-botdockerfile) |

---

## 3. Container Standards & Security Guidelines

1. **Non-Root Execution:** Node-based runtime containers execute under the unprivileged `node` user (UID 1000).
2. **Deterministic Installs:** Build stages use `npm ci` rather than `npm install` for reproducible dependency trees.
3. **Multi-Stage Builds:** Development dependencies (`devDependencies`) and intermediate build artifacts are discarded from production runtime images.
4. **Health Checks:** Services declare HTTP healthcheck probes (`wget`) enabling Docker Compose to coordinate startup dependencies reliably.
