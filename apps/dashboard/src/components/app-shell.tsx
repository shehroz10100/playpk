'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  getAccessToken,
  getStoredUser,
  applyMeUserToSession,
  type AuthUser,
} from '@/lib/auth';
import { homePathForRole, isStaffRole } from '@/lib/roles';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/sidebar';
import { CompanyNotifications } from '@/components/company-notifications';
import { NotificationsProvider } from '@/components/notifications-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();

  useEffect(() => {
    const token = getAccessToken();
    const user = getStoredUser();
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    if (!isStaffRole(user.role)) {
      router.replace(homePathForRole(user.role));
      return;
    }

    const companyMatch = pathname.match(/\/companies\/([^/]+)/);
    const branchMatch = pathname.match(/\/branches\/([^/]+)/);
    const nextBranchId = branchMatch?.[1];
    const nextCompanyId = companyMatch?.[1];

    setBranchId(nextBranchId);
    // Paint shell immediately; resolve company id in background.
    if (nextCompanyId) setCompanyId(nextCompanyId);
    setReady(true);

    let cancelled = false;
    async function resolveCompany() {
      try {
        const { data } = await api<AuthUser>('/api/auth/me');
        if (applyMeUserToSession(data) && !isStaffRole(data.role)) {
          if (!cancelled) router.replace(homePathForRole(data.role));
          return;
        }
      } catch {
        /* keep stored session */
      }

      if (nextCompanyId) {
        if (!cancelled) setCompanyId(nextCompanyId);
        return;
      }
      if (nextBranchId) {
        try {
          const { data } = await api<{ company: { id: string } }>(`/api/branches/${nextBranchId}`);
          if (!cancelled) setCompanyId(data.company.id);
        } catch {
          if (!cancelled) setCompanyId(undefined);
        }
        return;
      }
      if (!cancelled) setCompanyId(undefined);
    }

    void resolveCompany();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted px-safe text-sm text-muted-foreground">
        <div className="animate-pulse font-display text-lg font-bold text-navy">
          Play<span className="text-brand">PK</span>
        </div>
      </div>
    );
  }

  return (
    <NotificationsProvider>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Sidebar companyId={companyId} branchId={branchId} />
        <main className="min-w-0 flex-1 overflow-auto bg-[#F7F9FC]">
          <div className="sticky top-0 z-20 flex items-center justify-end border-b border-border bg-white/95 px-4 py-2 backdrop-blur sm:px-6 px-safe">
            <CompanyNotifications />
          </div>
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 px-safe">{children}</div>
        </main>
      </div>
    </NotificationsProvider>
  );
}
