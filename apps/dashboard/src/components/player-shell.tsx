'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bot,
  CalendarDays,
  Home,
  LogOut,
  Swords,
  Ticket,
  Trophy,
  Users,
  UserRound,
} from 'lucide-react';
import { clearSession, getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';
import { homePathForRole, isPlayerRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/components/notifications-provider';

const headerTabs = [
  {
    href: '/my-bookings',
    label: 'Bookings',
    icon: Ticket,
    match: (p: string) => p.startsWith('/my-bookings') || p.startsWith('/book'),
  },
  { href: '/events', label: 'Events', icon: CalendarDays, match: (p: string) => p.startsWith('/events') },
  { href: '/ai', label: 'AI', icon: Bot, match: (p: string) => p.startsWith('/ai') },
] as const;

const tabs = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/play', label: 'Play', icon: Swords },
  { href: '/social', label: 'Social', icon: Users },
  { href: '/rank', label: 'Rank', icon: Trophy },
  { href: '/me', label: 'Me', icon: UserRound },
] as const;

export function PlayerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { unread } = useNotifications();

  useEffect(() => {
    const token = getAccessToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace('/login');
      return;
    }
    if (!isPlayerRole(stored.role)) {
      router.replace(homePathForRole(stored.role));
      return;
    }
    setUser(stored);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <div className="animate-pulse font-display text-lg font-bold text-navy">
          Play<span className="text-brand">PK</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/95 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/discover" className="font-display text-xl font-extrabold tracking-tight">
            Play<span className="text-brand">PK</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-semibold text-white">{user?.name ?? 'Player'}</div>
              <div className="truncate text-white/55">{user?.email}</div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
              onClick={() => {
                clearSession();
                router.replace('/login');
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        <nav aria-label="Bookings Events AI" className="border-t border-white/10 bg-navy">
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-1 px-2 py-1.5 sm:px-6">
            {headerTabs.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[12px] font-semibold transition sm:text-[13px]',
                    active
                      ? 'bg-brand text-white'
                      : 'text-white/65 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">{children}</main>

      <nav
        aria-label="Customer"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 shadow-[0_-8px_24px_rgba(11,31,58,0.06)] backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.href === '/discover' &&
                (pathname.startsWith('/venues') ||
                  pathname.startsWith('/courts') ||
                  pathname.startsWith('/book')));
            const showBadge = item.href === '/me' && unread > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold transition sm:text-[11px]',
                  active ? 'text-brand' : 'text-navy/45 hover:text-navy',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-xl transition',
                    active ? 'bg-brand/12' : 'bg-transparent',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} />
                  {showBadge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-brand px-0.5 text-[9px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
