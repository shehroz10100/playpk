import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NotificationDto } from '@playpk/shared-types';
import { api } from '../lib/api';
import { useAppStatePoll } from './useAppStatePoll';

type NotificationsContextValue = {
  notifications: NotificationDto[];
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api<NotificationDto[]>('/api/notifications/me');
      setNotifications(data);
    } catch {
      /* offline */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    await api('/api/notifications/me/read-all', { method: 'POST' });
    await refresh();
  }, [refresh]);

  useAppStatePoll(() => void refresh(), true, { intervalMs: 30000 });

  const unread = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const value = useMemo(
    () => ({ notifications, unread, refresh, markAllRead }),
    [notifications, unread, refresh, markAllRead],
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
