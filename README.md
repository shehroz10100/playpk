# PlayPK

Multi-sport venue booking platform for Pakistan — a **Sports Operating System**.

PlayPK connects players, venue companies, and platform admins to search, book, and operate sports courts (padel, cricket, futsal, badminton, and more).

## Monorepo layout

```
playpk/
├── apps/
│   ├── api/          # Node.js + Express + TypeScript + Prisma REST API
│   ├── mobile/       # React Native (Expo) — deferred
│   └── dashboard/    # Next.js company + admin UI — deferred
├── packages/
│   ├── shared-types/ # Shared enums & API response types
│   └── config/       # Shared TSConfig / tooling
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js **≥ 20**
- npm **≥ 10** (workspaces)
- **Docker Desktop** (recommended) for Postgres + Redis

## Quick start (Docker — recommended)

### 1. Start Postgres + Redis

```bash
docker compose up -d
# or: npm run docker:up
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment

```bash
cp .env.example apps/api/.env
```

### 4. Migrate + seed

```bash
npm run db:generate
cd apps/api && npx prisma migrate deploy && npm run db:seed && cd ../..
```

On a fresh clone, `migrate deploy` applies the committed `init` migration. For iterative schema work use `npm run db:migrate`.

### 5. Run the API

```bash
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:4000 | API root |
| http://localhost:4000/health | Health check (Postgres + Redis) |
| http://localhost:4000/api | API index |

### Demo accounts (from seed)

| Role   | Email               | Password       |
|--------|---------------------|----------------|
| Owner  | owner@playpk.demo  | PlayPK@demo1   |
| Player | player@playpk.demo  | PlayPK@player1 |

Seed also creates **GameOn Sports** (Lahore DHA Phase 5) with 5 courts and 7 days of hourly slots.

## Fallback without Docker

If Docker is not installed, you can still smoke-test migrate → seed → `/health` using embedded Postgres + Redis Memory Server:

```bash
npm install
npm run verify:stack
```

Day-to-day development should still use `docker compose up -d`.

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run docker:up` | Start Postgres + Redis |
| `npm run docker:down` | Stop containers |
| `npm run dev` | Start API in watch mode |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Seed sports + demo venue |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:api` | Run API Jest tests |
| `npm run verify:stack` | Ephemeral migrate/seed/health check |

## Tech stack (MVP)

- **API:** Express, TypeScript, Prisma, Zod
- **DB:** PostgreSQL 16 + Redis 7 via Docker Compose
- **Auth:** JWT + refresh tokens (Phase 1)
- **Payments:** `PaymentProvider` interface + mock provider
- **Storage:** S3-compatible interface + local disk provider for dev

## Current status

✅ Monorepo skeleton  
✅ Docker Compose (Postgres + Redis)  
✅ API bootstrap + Prisma schema + `init` migration + seed  
✅ `GET /health`  
✅ Payment + storage abstractions (mock/local)  
⏳ Auth & booking API (Phase 1)  
⏳ Mobile app  
⏳ Dashboard  

## Seeded sports

Cricket, Padel, Futsal, Badminton, Pickleball, Tennis, Squash, Basketball, Volleyball, Table Tennis, Swimming, Gym, Snooker, Bowling
