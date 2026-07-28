'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Percent,
  TicketPercent,
  Users,
  X,
} from 'lucide-react';
import { clearSession, getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const items = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
  { href: '/admin/tickets', label: 'Support inbox', icon: MessageSquareWarning },
  { href: '/admin/reports', label: 'Reports', icon: Percent },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">PlayPK Admin</div>
            <div className="mt-1 text-xs text-white/60">Platform operations</div>
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                active ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 truncate text-sm text-white/80">{user?.name ?? 'Admin'}</div>
        <div className="mb-3 truncate text-xs text-white/50">{user?.email}</div>
        <Button
          variant="outline"
          className="w-full border-white/20 bg-transparent text-white hover:bg-white/10"
          onClick={() => {
            clearSession();
            router.replace('/login');
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
        <div>
          <div className="text-sm font-semibold text-navy">PlayPK Admin</div>
          <div className="text-xs text-muted-foreground">Platform operations</div>
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-navy"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-navy/40 lg:hidden"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,86vw)] flex-col bg-navy text-white transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {nav}
      </aside>
    </>
  );
}
