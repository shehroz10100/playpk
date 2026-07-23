# PlayPK

Multi-sport venue booking platform for Pakistan — a **Sports Operating System**.

PlayPK connects players, venue companies, and platform admins to search, book, and operate sports courts (padel, cricket, futsal, badminton, and more).

## Apps

| App | Path | Local | Production |
|-----|------|-------|------------|
| API | `apps/api` | `:4000` | Railway |
| Dashboard | `apps/dashboard` | `:3000` | https://playpk.vercel.app |
| Walk-in POS | `apps/walkin` | `:3001` | **Separate Vercel project** (see below) |
| Mobile | `apps/mobile` | Expo | — |

## Walk-in desk on Vercel

`playpk.vercel.app` is the player/company portal only. Deploy walk-in as a **second** Vercel project:

1. [vercel.com/new](https://vercel.com/new) → Import **shehroz10100/playpk**
2. Name e.g. `playpk-walkin`
3. **Root Directory** = `apps/walkin`
4. Env (Production + Preview):
   - `NEXT_PUBLIC_API_URL` = `https://api-production-2057.up.railway.app`
   - `API_URL` = `https://api-production-2057.up.railway.app`
5. Deploy → open `/login`
6. Login: `frontdesk@playpk.demo` / `PlayPK@desk1`  
   (User must exist in Railway DB — run API seed on Railway if needed.)

Config lives in `apps/walkin/vercel.json` + `scripts/vercel-install-walkin.sh`.

## Local quick start

```bash
npm install
npm run docker:up
npm run db:migrate && npm run db:seed
npm run dev:api
npm run dev:dashboard   # :3000
npm run dev:walkin      # :3001
```

See `.env.example` and `apps/walkin/.env.example` for env vars.
