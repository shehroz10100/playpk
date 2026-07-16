import { PlayerShell } from '@/components/player-shell';
import { NotificationsProvider } from '@/components/notifications-provider';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      <PlayerShell>{children}</PlayerShell>
    </NotificationsProvider>
  );
}
