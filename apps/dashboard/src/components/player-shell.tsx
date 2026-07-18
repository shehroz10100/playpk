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
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/notifications-provider';

/** Top utility strip — same visual language as bottom tabs */
const headerTabs = [
  { href: '/my-bookings', label: 'Bookings', icon: Ticket, match: (p: string) => p.startsWith('/my-bookings') || p.startsWith('/book') },
  { href: '/events', label: 'Events', icon: CalendarDays, match: (p: string) => p.startsWith('/events') },
  { href: '/ai', label: 'AI', icon: Bot, match: (p: string) => p.startsWith('/ai') },
] as const;

/** Bottom primary bar */
const tabs = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/play', label: 'Play', icon: Swords },
  { href: '/social', label: 'Social', icon: Users },
  { href: '/rank', label: 'Rank', icon: Trophy },
  { href: '/me', label: 'Me', icon: UserRound },
] as const;

function tabActiveClass(active: boolean) {
  return active ? 'bg-brand/10 text-brand' : 'text-navy/55 hover:bg-brand/5 hover:text-navy';
}

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
      <div className="flex min-h-screen items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading PlayPK…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/discover" className="text-lg font-semibold tracking-tight text-navy">
            Play<span className="text-brand">PK</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium text-navy">{user?.name ?? 'Player'}</div>
              <div className="truncate text-muted-foreground">{user?.email}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-brand/20 text-navy hover:border-brand/40 hover:bg-brand/5"
              onClick={() => {
                clearSession();
                router.replace('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        {/* Full-width secondary nav — same theme as bottom bar */}
        <nav
          aria-label="Bookings Events AI"
          className="border-t border-border/80 bg-white"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-1 px-2 py-1.5 sm:px-6">
            {headerTabs.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-[12px] font-semibold transition-colors sm:text-[13px]',
                    tabActiveClass(active),
                  )}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <nav
        aria-label="Customer"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.href === '/discover' && pathname.startsWith('/venues')) ||
              (item.href === '/discover' && pathname.startsWith('/courts')) ||
              (item.href === '/discover' && pathname.startsWith('/book'));
            const showBadge = item.href === '/me' && unread > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors',
                  tabActiveClass(active),
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {showBadge ? (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-0.5 text-[9px] font-bold text-white">
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
