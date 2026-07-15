import { PlayerShell } from '@/components/player-shell';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <PlayerShell>{children}</PlayerShell>;
}
