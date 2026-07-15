# PlayPK

Multi-sport venue booking platform for Pakistan — a **Sports Operating System**.

PlayPK connects players, venue companies, and platform admins to search, book, and operate sports courts (padel, cricket, futsal, badminton, and more).

## Monorepo layout

```
playpk/
├── apps/
│   ├── api/          # Express + TypeScript + Prisma REST API
│   ├── mobile/       # Expo (React Native) customer app
│   └── dashboard/    # Next.js company dashboard (+ admin later)
├── packages/
│   ├── shared-types/ # Shared enums & API DTOs (import as @playpk/shared-types)
│   └── config/       # Shared TSConfig / tooling
├── docker-compose.yml
├── .env.example
└── README.md
```

## Prerequisites

- Node.js **≥ 20**
- npm **≥ 10** (workspaces)
- Docker Desktop (Postgres + Redis)
- Expo Go (optional, for physical-device mobile testing)

## First-time setup

```bash
# 1. Infrastructure
docker compose up -d

# 2. Dependencies
npm install

# 3. Environment (never commit real secrets)
cp .env.example apps/api/.env
# Dashboard + mobile public API URL (optional if using defaults):
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > apps/dashboard/.env.local
echo "EXPO_PUBLIC_API_URL=http://localhost:4000" > apps/mobile/.env

# 4. Database
npm run db:generate
cd apps/api && npx prisma migrate deploy && npm run db:seed && cd ../..
```

## Run locally

Use **three terminals** (or run what you need):

```bash
npm run docker:up        # Postgres :5432 + Redis :6379
npm run dev:api          # http://localhost:4000
npm run dev:dashboard    # http://localhost:3000
npm run dev:mobile       # Expo Metro :8081
```

| App | URL / command | Demo login |
|-----|---------------|------------|
| API | http://localhost:4000/health | — |
| **Unified portal** | http://localhost:3000/login | Customer / Company / Admin (same page) |
| Mobile (optional) | Expo Metro http://localhost:8081 | same player account |

One sign-in at `/login` routes by role:

| Role | Demo email | Password | Lands on |
|------|------------|----------|----------|
| Customer | player@playpk.demo | PlayPK@player1 | `/discover` |
| GameOn owner | owner@playpk.demo | PlayPK@demo1 | `/companies` |
| 360 Arena owner | owner360@playpk.demo | PlayPK@3601 | `/companies` |
| Admin | admin@playpk.demo | PlayPK@admin1 | `/admin` |

### Mobile notes

- iOS Simulator / Expo web: `EXPO_PUBLIC_API_URL=http://localhost:4000`
- Physical phone: set `EXPO_PUBLIC_API_URL` to your Mac LAN IP, e.g. `http://192.168.1.10:4000`, and ensure the phone is on the same Wi‑Fi.
- Start with `npm run dev:mobile`, then press `i` / `a` or scan the QR in Expo Go.

### Shared types

All cross-app enums and API DTOs live in [`packages/shared-types`](packages/shared-types). Import them as:

```ts
import type { AuthUser, BookingDto, VenueListItem } from '@playpk/shared-types';
```

Do **not** duplicate these contracts in `apps/api`, `apps/dashboard`, or `apps/mobile`.

## Environment variables

See [`.env.example`](.env.example) for the full list. Summary:

| Variable | App | Purpose |
|----------|-----|---------|
| `DATABASE_URL` | api | Postgres connection |
| `REDIS_URL` | api | Redis / slot locks |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | api | JWT signing (change before deploy) |
| `STORAGE_*` | api | Local/S3-compatible uploads |
| `LLM_PROVIDER` / `OPENAI_API_KEY` | api | Chatbot intent parser (`mock` by default) |
| `NEXT_PUBLIC_API_URL` | dashboard | API base URL |
| `EXPO_PUBLIC_API_URL` | mobile | API base URL |

## Useful scripts

| Script | Description |
|--------|-------------|
| `npm run docker:up` / `docker:down` | Start/stop Postgres + Redis |
| `npm run dev:api` | API watch mode |
| `npm run dev:dashboard` | Next.js dashboard |
| `npm run dev:mobile` | Expo Metro |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Seed sports + demo venue |
| `npm run db:studio` | Prisma Studio |
| `npm run test:api` | Jest (incl. double-booking / Redis lock) |
| `npm run verify:stack` | Ephemeral migrate/seed/health without Docker |

## Fallback without Docker

```bash
npm install
npm run verify:stack
```

Uses embedded Postgres + Redis Memory Server for a one-shot smoke test only.

## API surface (high level)

- Auth: `/api/auth/*` (register, login, OTP, refresh, me)
- Staff: companies, branches, courts, slot generate/edit, branch bookings/stats
- Public/player: `/api/venues`, `/api/slots/search`, `/api/slots/court/:id/availability`, `/api/bookings`
- Loyalty: `GET /api/loyalty/me` (points + Bronze/Silver/Gold/Diamond tier)
- Wallet: `GET /api/wallet/me`, `POST /api/wallet/topup` (mock); book with `paymentMethod: "wallet"`
- Reviews: `GET|POST /api/reviews/branches/:branchId` (post requires completed booking)
- Waitlist: `POST /api/waitlist/slots/:slotId`; staff `GET /api/waitlist/branches/:branchId`
- Notifications: `GET /api/notifications/me` (waitlist promotions)
- AI: `POST /api/ai/pricing/suggest`, `GET /api/ai/analytics`, `POST /api/ai/chat`
- Tournaments: `/api/tournaments` (CRUD, register, knockout fixtures, results, standings)
- Teams: `/api/teams` (create, invite by email/phone, accept/decline)
- Leaderboard: `GET /api/leaderboard?branchId=`
- Admin (ADMIN role): `/api/admin/*` — users, company/branch approvals, commission, reports, coupons, tickets
- Support: `POST /api/support/tickets` (authenticated)
- Sports: `/api/sports`

### Admin dashboard

Log in as `admin@playpk.demo` → redirects to `/admin`:

- Users — list/search/suspend
- Companies — approve/reject PENDING, edit commission %
- Reports — platform bookings & revenue
- Coupons — platform-wide coupon CRUD
- Tickets — support inbox

## Seeded demo data

| Role | Email | Password |
|------|-------|----------|
| Customer (player) | player@playpk.demo | PlayPK@player1 |
| GameOn Sports owner | owner@playpk.demo | PlayPK@demo1 |
| 360 Arena owner | owner360@playpk.demo | PlayPK@3601 |
| Platform admin | admin@playpk.demo | PlayPK@admin1 |

Also seeds **GameOn Sports · DHA Phase 5 (Lahore)** with 5 courts and 7 days of slots, plus 14 sports.

## Current status

✅ Monorepo + Docker Compose  
✅ Phase 1 API (auth, CRUD, Redis slot locks, venues, bookings)  
✅ Loyalty / wallet / reviews / waitlist (+ auto-promote on cancel)  
✅ AI layer (rules pricing, analytics + forecast, chatbot with swappable LLM)  
✅ Tournaments & community (knockout fixtures, teams, leaderboard)  
✅ Admin portal (`/admin`) — users, approvals, reports, coupons, support  
✅ Company dashboard (analytics, tournaments management)  
✅ Mobile (Expo) — Ask AI, Events, teams  
⏳ Admin panel enhancements (fraud / KYC)  
⏳ Real JazzCash / Easypaisa / card adapters  
⏳ ML pricing model (interface ready; rules-based today)  
⏳ League / groups tournament formats  


## Conventions

- Shared TypeScript contracts → `packages/shared-types` only  
- Secrets → `.env` / `.env.local` (never hardcoded); keep `.env.example` in sync  
- After each major phase: update this README’s run instructions
