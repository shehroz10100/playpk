'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bot,
  CalendarDays,
  Hash,
  Home,
  LogOut,
  MessageSquarePlus,
  Plus,
  Swords,
  Ticket,
  Trophy,
  Users,
  UserRound,
  X,
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
  {
    href: '/events',
    label: 'Events',
    icon: CalendarDays,
    match: (p: string) => p.startsWith('/events') || p.startsWith('/my-tournaments'),
  },
  { href: '/ai', label: 'AI', icon: Bot, match: (p: string) => p.startsWith('/ai') },
] as const;

const tabs = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/play', label: 'Play', icon: Swords },
  { href: '/channels', label: 'Chat', icon: Hash },
  { href: '/social', label: 'Social', icon: Users },
  { href: '/rank', label: 'Rank', icon: Trophy },
  { href: '/me', label: 'Me', icon: UserRound },
] as const;

export function PlayerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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

  useEffect(() => {
    setCreateOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <div className="animate-pulse font-display text-lg font-bold text-navy">
          Play<span className="text-brand">PK</span>
        </div>
      </div>
    );
  }

  const hideFab =
    pathname.startsWith('/courts') ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/venues/');

  return (
    <div className="min-h-screen pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/95 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/discover"
            className="font-display text-xl font-extrabold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Play<span className="text-brand">PK</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-semibold text-white">{user?.name ?? 'Player'}</div>
              <div className="truncate text-white/70">{user?.email}</div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 min-w-10 cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
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
                    'relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-[12px] font-semibold transition sm:text-[13px]',
                    active
                      ? 'bg-brand text-white'
                      : 'text-white/70 hover:bg-white/8 hover:text-white',
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

      {/* PlayPro-style + create menu */}
      {createOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-navy/50 backdrop-blur-[2px]"
            aria-label="Close create menu"
            onClick={() => setCreateOpen(false)}
          />
          <div className="absolute bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 w-[min(18rem,calc(100vw-2rem))] animate-rise overflow-hidden rounded-2xl bg-white shadow-panel sm:right-8">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Create</p>
              <p className="text-sm font-semibold text-navy">What do you want to post?</p>
            </div>
            <Link
              href="/play?create=1"
              className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-brand/5"
              onClick={() => setCreateOpen(false)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Swords className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-navy">Create open match</span>
                <span className="text-xs text-muted-foreground">Find players for a game</span>
              </span>
            </Link>
            <Link
              href="/channels?tab=create"
              className="flex cursor-pointer items-center gap-3 border-t border-border px-4 py-3.5 transition hover:bg-brand/5"
              onClick={() => setCreateOpen(false)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Hash className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-navy">Create channel</span>
                <span className="text-xs text-muted-foreground">Sport, venue, or area chat room</span>
              </span>
            </Link>
            <Link
              href="/social?compose=1"
              className="flex cursor-pointer items-center gap-3 border-t border-border px-4 py-3.5 transition hover:bg-brand/5"
              onClick={() => setCreateOpen(false)}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/8 text-navy">
                <MessageSquarePlus className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-navy">Create post</span>
                <span className="text-xs text-muted-foreground">Share with your network</span>
              </span>
            </Link>
          </div>
        </div>
      ) : null}

      {!hideFab ? (
        <button
          type="button"
          aria-label={createOpen ? 'Close create menu' : 'Create match or post'}
          aria-expanded={createOpen}
          onClick={() => setCreateOpen((o) => !o)}
          className={cn(
            'fixed z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_24px_rgba(0,166,81,0.45)] transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2',
            'right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:right-8',
          )}
        >
          {createOpen ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" strokeWidth={2.5} />}
        </button>
      ) : null}

      <nav
        aria-label="Customer"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 shadow-[0_-8px_24px_rgba(11,31,58,0.06)] backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-0.5 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
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
                  'relative flex min-h-[3.25rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-bold transition sm:text-xs',
                  active ? 'text-brand' : 'text-navy/60 hover:text-navy',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-xl transition',
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
