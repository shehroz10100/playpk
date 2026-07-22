/**
 * Sync Prisma demo accounts into Supabase Auth only (no full DB seed).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:sync-supabase-auth --workspace=@playpk/api
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { syncDemoUsersToSupabaseAuth } from '../prisma/sync-supabase-auth';

loadEnv({ path: path.resolve(__dirname, '../.env') });

const DEMOS = [
  {
    email: 'admin@playpk.demo',
    password: 'PlayPK@admin1',
    name: 'PlayPK Admin',
    role: 'ADMIN',
    phone: '+923000000001',
  },
  {
    email: 'owner@playpk.demo',
    password: 'PlayPK@demo1',
    name: 'GameOn Owner',
    role: 'COMPANY_OWNER',
    phone: '+923001234567',
  },
  {
    email: 'owner360@playpk.demo',
    password: 'PlayPK@3601',
    name: '360 Arena Owner',
    role: 'COMPANY_OWNER',
    phone: '+923001111360',
  },
  {
    email: 'player@playpk.demo',
    password: 'PlayPK@player1',
    name: 'Sara Ahmed',
    role: 'PLAYER',
    phone: '+923009876543',
  },
  {
    email: 'player2@playpk.demo',
    password: 'PlayPK@player2',
    name: 'Ali Raza',
    role: 'PLAYER',
    phone: '+923009876544',
  },
] as const;

async function main(): Promise<void> {
  const ok = await syncDemoUsersToSupabaseAuth([...DEMOS]);
  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error('❌ Supabase Auth sync failed:', err);
  process.exitCode = 1;
});
