'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, getSelectedBranch } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    router.replace(getSelectedBranch() ? '/desk' : '/login');
  }, [router]);

  return <p className="p-8 text-sm text-navy/70">Loading…</p>;
}
