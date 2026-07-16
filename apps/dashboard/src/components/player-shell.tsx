'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bot, CalendarDays, Home, LogOut, Ticket, UserRound } from 'lucide-react';
import { clearSession, getAccessToken, getStoredUser, type AuthUser } from '@/lib/auth';
import { homePathForRole, isPlayerRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/notifications-provider';

/** Matches mobile bottom bar: Home, Book, Events, AI, Me */
const tabs = [
  { href: '/discover', label: 'Home', icon: Home },
  { href: '/my-bookings', label: 'Book', icon: Ticket },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/ai', label: 'AI', icon: Bot },
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
      <div className="flex min-h-screen items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading PlayPK…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/discover" className="text-lg font-semibold tracking-tight text-navy">
            PlayPK
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium text-navy">{user?.name ?? 'Player'}</div>
              <div className="text-muted-foreground">{user?.email}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void clearSession().then(() => router.replace('/login'));
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
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
                  active ? 'bg-brand/10 text-brand' : 'text-navy/55 hover:text-navy',
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
