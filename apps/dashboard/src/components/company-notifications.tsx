'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/notifications-provider';

export function CompanyNotifications() {
  const [open, setOpen] = useState(false);
  const { notifications: items, unread, markAllRead } = useNotifications();
  const [error, setError] = useState<string | null>(null);

  const markAllReadSafe = useCallback(async () => {
    try {
      await markAllRead();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark read');
    }
  }, [markAllRead]);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-navy">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-brand hover:underline"
                onClick={() => void markAllReadSafe()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {error ? <p className="px-3 py-3 text-xs text-red-600">{error}</p> : null}
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No notifications yet. New customer bookings appear here.
              </p>
            ) : (
              items.slice(0, 20).map((n) => {
                const meta = (n.meta ?? {}) as Record<string, unknown>;
                const bookingId = typeof meta.bookingId === 'string' ? meta.bookingId : null;
                const branchId = typeof meta.branchId === 'string' ? meta.branchId : null;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'border-b border-border px-3 py-3 last:border-0',
                      !n.readAt ? 'bg-brand/5' : 'bg-white',
                    )}
                  >
                    <p className="text-sm font-semibold text-navy">{n.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                    {bookingId ? (
                      <p className="mt-1 font-mono text-[11px] text-navy/80">ID: {bookingId}</p>
                    ) : null}
                    {branchId && bookingId ? (
                      <Link
                        href={`/branches/${branchId}/bookings`}
                        className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        Open bookings →
                      </Link>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
