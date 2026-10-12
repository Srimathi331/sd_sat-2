# 📰 Personalized News Platform

A microservice-based backend (plus API client) for a personalized news platform that supports millions of users and continuously changing content.

**Stack:** Node.js · Express · PostgreSQL · MongoDB · Redis · Apache Kafka · Docker · Kubernetes

## Task → code map

| Task | Where |
|---|---|
| 1. System architecture (users, articles, topics, feeds, notifications) | `services/*`, `docs/ARCHITECTURE.md` §1 |
| 2. REST API communication | gateway `services/api-gateway`, `docs/API.md`, resilient client `packages/common/src/http.js`, app client `client/api-client.js` |
| 3. Database selection | `services/user-service/src/schema.sql`, `services/topic-service/src/schema.sql`, `services/article-service/src/db.js`, `services/feed-service/src/interactions.js`, `docs/ARCHITECTURE.md` §3 |
| 4. Caching | `packages/common/src/cache.js`, `services/feed-service/src/{trending,articleStore}.js`, §4 |
| 5. Messaging | `packages/common/src/kafka.js`, `services/*/src/consumers.js`, `services/notification-service/src/{fanout,delivery}.js`, §5 |
| 6. Scalability | `infra/k8s/*` (HPA + KEDA), gateway rate-limit, circuit breaker, §6 |
| Extra: **Get Trending News API** | `GET /api/v1/trending` → `services/feed-service/src/{routes,trending}.js` |

## Project structure

```
news-platform/
├── docker-compose.yml          # full local stack (Postgres, Mongo, Redis, Kafka + all services)
├── packages/common/            # shared library: auth, cache, kafka, http client, errors, server bootstrap
├── services/
│   ├── api-gateway/            # entry point: auth, rate limit, routing
│   ├── user-service/           # PostgreSQL - accounts, preferences, devices
│   ├── topic-service/          # PostgreSQL + Redis - topics, follows
│   ├── article-service/        # MongoDB + Redis - articles, interactions -> Kafka
│   ├── feed-service/           # Redis + Kafka - personalised feed, trending, history
│   └── notification-service/   # Kafka - fan-out, push/email/in-app/SSE
├── infra/                      # postgres init, Kubernetes manifests (HPA, KEDA)
├── client/api-client.js        # how web/mobile apps call the backend
├── docs/                       # ARCHITECTURE.md (diagrams), API.md
└── scripts/demo.sh             # end-to-end curl demo
```

## Run locally

```bash
cp .env.example .env
docker compose up --build          # gateway on http://localhost:8080
./scripts/demo.sh                  # register -> follow topic -> feed -> trending
npm test                           # ranking unit tests
```

## Request flow (example)

1. Editor `POST /articles` (`isBreaking: true`) → saved in MongoDB → events `article.published` + `news.breaking` on Kafka.
2. **feed-service** indexes it in Redis (`topic:latest:*`) - it appears in feeds within seconds.
3. **notification-service** pages through topic followers, de-duplicates, emits batches → delivery workers send push/email/in-app + SSE.
4. Readers' views/likes → `user.interaction` events → Redis trending buckets → `GET /trending`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for diagrams and design reasoning.
