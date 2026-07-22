/**
 * Upsert demo accounts into Supabase Auth (Authentication → Users).
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Skips quietly when unset — Prisma login still works without this.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DemoAuthUser = {
  email: string;
  password: string;
  name: string;
  role: string;
  phone?: string | null;
  /** Prisma User.id — stored in app_metadata for cross-reference */
  playpkUserId?: string;
};

function isConfiguredUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (url.includes('YOUR_PROJECT')) return false;
  return url.startsWith('https://');
}

function isConfiguredKey(key: string | undefined): key is string {
  if (!key) return false;
  if (key === 'your-anon-key' || key.startsWith('your-')) return false;
  return key.length > 20;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!isConfiguredUrl(url) || !isConfiguredKey(serviceKey)) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  // Paginate — demo sets are small, but projects can grow.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function upsertSupabaseAuthUser(
  admin: SupabaseClient,
  user: DemoAuthUser,
): Promise<'created' | 'updated'> {
  const email = user.email.trim().toLowerCase();
  const user_metadata = {
    display_name: user.name,
    full_name: user.name,
    name: user.name,
    playpk_role: user.role,
  };
  const app_metadata = {
    playpk_role: user.role,
    ...(user.playpkUserId ? { playpk_user_id: user.playpkUserId } : {}),
  };

  const existingId = await findAuthUserIdByEmail(admin, email);

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password: user.password,
      email_confirm: true,
      user_metadata,
      app_metadata,
    });
    if (error) throw error;
    return 'updated';
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: user.password,
    email_confirm: true,
    user_metadata,
    app_metadata,
  });
  if (error) throw error;
  return 'created';
}

/** Sync all demo users. Returns false when Supabase admin is not configured. */
export async function syncDemoUsersToSupabaseAuth(
  users: DemoAuthUser[],
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.log(
      'ℹ Supabase Auth sync skipped — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in apps/api/.env',
    );
    return false;
  }

  console.log('☁ Syncing demo users to Supabase Auth…');
  for (const user of users) {
    const action = await upsertSupabaseAuthUser(admin, user);
    console.log(`  ✓ Auth ${action}: ${user.email} (${user.name})`);
  }
  return true;
}
