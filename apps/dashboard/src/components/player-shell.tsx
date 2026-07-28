'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bot,
  CalendarDays,
  Home,
  LogOut,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  Swords,
  Ticket,
  Trophy,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import { clearSession, getAccessToken, getStoredUser, applyMeUserToSession, type AuthUser } from '@/lib/auth';
import { canUsePlayerApp, homePathForRole, isStaffRole } from '@/lib/roles';
import { api } from '@/lib/api';
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
  { href: '/channels', label: 'Chat', icon: MessageCircle },
  { href: '/social', label: 'Social', icon: Users },
  { href: '/rank', label: 'Rank', icon: Trophy },
  { href: '/me', label: 'Me', icon: UserRound },
] as const;

function tabActive(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === '/discover' &&
      (pathname.startsWith('/venues') ||
        pathname.startsWith('/courts') ||
        pathname.startsWith('/book')))
  );
}

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
    // Company staff may browse discover/book; do not kick them to /companies.
    if (!canUsePlayerApp(stored.role)) {
      router.replace(homePathForRole(stored.role));
      return;
    }
    setUser(stored);
    setReady(true);

    // Refresh profile from API, but never swap to another account's /me payload.
    void api<AuthUser>('/api/auth/me')
      .then(({ data }) => {
        if (!applyMeUserToSession(data)) return;
        setUser(data);
        if (!canUsePlayerApp(data.role)) {
          router.replace(homePathForRole(data.role));
        }
      })
      .catch(() => {
        /* keep stored session */
      });
  }, [router]);

  useEffect(() => {
    setCreateOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-safe text-sm text-muted-foreground">
        <div className="animate-pulse font-display text-lg font-bold text-navy">
          Play<span className="text-brand">PK</span>
        </div>
      </div>
    );
  }

  // Discover already has create CTAs in-hero; hide FAB so it doesn't cover sport chips.
  const hideFab =
    pathname.startsWith('/discover') ||
    pathname === '/' ||
    pathname.startsWith('/courts') ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/venues/');

  return (
    <div className="min-h-dvh overflow-x-hidden pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
      {user && isStaffRole(user.role) ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:px-6 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
          Browsing as company staff ({user.email}). Player bookings use this account —{' '}
          <Link href="/companies" className="font-semibold underline">
            open company dashboard
          </Link>{' '}
          or sign out to use a player login.
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy text-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 py-2.5 sm:py-3 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] sm:px-6">
          <Link
            href="/discover"
            className="font-display text-lg font-extrabold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:text-xl"
          >
            Play<span className="text-brand">PK</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {user && isStaffRole(user.role) ? (
              <Link
                href="/companies"
                className="hidden rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
              >
                Company dashboard
              </Link>
            ) : null}
            <div className="hidden text-right text-xs sm:block">
              <div className="font-semibold text-white">{user?.name ?? 'Player'}</div>
              <div className="truncate text-white/70">{user?.email}</div>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs sm:font-semibold"
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

        <nav aria-label="Bookings Events AI" className="border-t border-white/10 bg-navy md:hidden">
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-0.5 px-1.5 py-1 [padding-left:max(0.375rem,env(safe-area-inset-left))] [padding-right:max(0.375rem,env(safe-area-inset-right))]">
            {headerTabs.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition sm:min-h-11 sm:gap-2 sm:text-[13px]',
                    active
                      ? 'bg-brand text-white'
                      : 'text-white/70 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Desktop: primary destinations in header (no fixed bottom bar). */}
        <nav aria-label="Primary" className="hidden border-t border-white/10 bg-navy md:block">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {[...tabs, ...headerTabs].map((item) => {
              const Icon = item.icon;
              const active =
                'match' in item && typeof item.match === 'function'
                  ? item.match(pathname)
                  : tabActive(pathname, item.href);
              return (
                <Link
                  key={`desk-${item.href}`}
                  href={item.href}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
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

      <main className="mx-auto w-full max-w-6xl pt-0 pb-5 sm:px-6 sm:py-7 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
        {children}
      </main>

      {/* PlayPro-style + create menu */}
      {createOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-navy/50 backdrop-blur-[2px]"
            aria-label="Close create menu"
            onClick={() => setCreateOpen(false)}
          />
          <div className="absolute bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 w-[min(18rem,calc(100vw-2rem))] animate-rise overflow-hidden rounded-2xl bg-white shadow-panel sm:right-8 md:bottom-24">
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
                <MessageCircle className="h-5 w-5" />
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
            'right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:right-8 md:bottom-8',
          )}
        >
          {createOpen ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" strokeWidth={2.5} />}
        </button>
      ) : null}

      <nav
        aria-label="Customer"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 shadow-[0_-8px_24px_rgba(11,31,58,0.06)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-0 px-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tabActive(pathname, item.href);
            const showBadge = item.href === '/me' && unread > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-bold leading-none transition',
                  active ? 'text-brand' : 'text-navy/55 active:text-navy',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-8 w-8 items-center justify-center rounded-lg transition',
                    active ? 'bg-brand/12' : 'bg-transparent',
                  )}
                >
                  <Icon className={cn('h-[1.15rem] w-[1.15rem]', active && 'stroke-[2.25]')} />
                  {showBadge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-md bg-brand px-0.5 text-[8px] font-bold text-white">
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
