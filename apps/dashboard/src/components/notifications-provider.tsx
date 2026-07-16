'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { NotificationDto } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { useVisibilityPoll } from '@/hooks/use-visibility-poll';

type NotificationsContextValue = {
  notifications: NotificationDto[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await api<NotificationDto[]>('/api/notifications/me');
      setNotifications(data);
    } catch {
      /* logged out / offline */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const markAllRead = useCallback(async () => {
    await api('/api/notifications/me/read-all', { method: 'POST' });
    await refresh();
  }, [refresh]);

  useVisibilityPoll(() => void refresh(), enabled, { intervalMs: 30000 });

  const unread = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const value = useMemo(
    () => ({ notifications, unread, loading, refresh, markAllRead }),
    [notifications, unread, loading, refresh, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
