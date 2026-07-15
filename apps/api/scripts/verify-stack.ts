/**
 * Starts ephemeral Postgres + Redis (no Docker required), applies migrations, seeds, and
 * boots the API long enough to hit GET /health.
 *
 * Preferred local workflow remains: `docker compose up -d` + `npm run dev`.
 * This script is a fallback for environments where Docker/Homebrew are unavailable.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';
import { RedisMemoryServer } from 'redis-memory-server';

const API_ROOT = process.cwd();
const PG_PORT = 55432;
const DATA_DIR = path.join(API_ROOT, '.embedded-pg');

async function waitForHealth(url: string, attempts = 60): Promise<unknown> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 503) {
        return res.json();
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: API_ROOT,
      env,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main(): Promise<void> {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'playpk',
    password: 'playpk',
    port: PG_PORT,
    persistent: false,
  });

  console.log('▶ Starting embedded Postgres...');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('playpk');

  console.log('▶ Starting Redis Memory Server...');
  const redis = await RedisMemoryServer.create();
  const redisHost = await redis.getHost();
  const redisPort = await redis.getPort();

  const databaseUrl = `postgresql://playpk:playpk@127.0.0.1:${PG_PORT}/playpk?schema=public`;
  const redisUrl = `redis://${redisHost}:${redisPort}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    PORT: '4000',
    NODE_ENV: 'development',
    JWT_ACCESS_SECRET: 'verify-access-secret-min-32-chars!!',
    JWT_REFRESH_SECRET: 'verify-refresh-secret-min-32-chars!',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  console.log('▶ Applying migrations...');
  await run('npx', ['prisma', 'migrate', 'deploy'], env);

  console.log('▶ Seeding...');
  await run('npx', ['tsx', 'prisma/seed.ts'], env);

  console.log('▶ Starting API...');
  const api = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: API_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  api.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  api.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  try {
    const health = await waitForHealth('http://127.0.0.1:4000/health');
    console.log('\n✅ Health response:', JSON.stringify(health, null, 2));

    const body = health as { success?: boolean; data?: { status?: string } };
    if (!body.success || body.data?.status !== 'ok') {
      throw new Error(`Unexpected health payload: ${JSON.stringify(body)}`);
    }
  } finally {
    api.kill('SIGTERM');
    await redis.stop();
    await pg.stop();
    await fs.rm(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('❌ verify-stack failed:', error);
  process.exit(1);
});
