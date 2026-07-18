'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser, LoyaltyStatusDto, WalletStatusDto } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { clearSession, getStoredUser, saveSession, getAccessToken, getRefreshToken } from '@/lib/auth';
import { formatPkr } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications } from '@/components/notifications-provider';

function tournamentIdFromMeta(meta?: Record<string, unknown> | null): string | null {
  if (!meta || meta.type !== 'TOURNAMENT_LISTED') return null;
  const id = meta.tournamentId;
  return typeof id === 'string' ? id : null;
}

export default function MePage() {
  const router = useRouter();
  const { notifications, markAllRead } = useNotifications();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyStatusDto | null>(null);
  const [wallet, setWallet] = useState<WalletStatusDto | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api<AuthUser>('/api/auth/me');
      setUser(data);
      const access = getAccessToken();
      const refreshTok = getRefreshToken();
      if (access && refreshTok) {
        saveSession({ accessToken: access, refreshToken: refreshTok, user: data });
      }
    } catch {
      setUser(getStoredUser());
    }
    try {
      const [loy, wal] = await Promise.all([
        api<LoyaltyStatusDto>('/api/loyalty/me'),
        api<WalletStatusDto>('/api/wallet/me'),
      ]);
      setLoyalty(loy.data);
      setWallet(wal.data);
    } catch {
      /* first load / offline */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function topUp() {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive PKR amount');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      await refresh();
      setMessage(`Wallet topped up · added ${formatPkr(amount)} (mock)`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Top-up failed');
    } finally {
      setBusy(false);
    }
  }

  async function markNotificationsRead() {
    try {
      await markAllRead();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark read');
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Me</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Loyalty, wallet, and alerts for tournaments and waitlist offers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{user?.name ?? 'Player'}</CardTitle>
          <CardDescription>{user?.email ?? user?.phone}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="success">
            {loyalty?.loyaltyTier ?? user?.loyaltyTier ?? 'BRONZE'}
          </Badge>
          <Badge variant="muted">PLAYER</Badge>
          <Link href="/play">
            <Badge variant="secondary">Open matches</Badge>
          </Link>
          <Link href="/social">
            <Badge variant="secondary">Social</Badge>
          </Link>
          <Link href="/rank">
            <Badge variant="secondary">Ranking</Badge>
          </Link>
          <Link href="/my-bookings">
            <Badge variant="secondary">Bookings</Badge>
          </Link>
          <Link href="/events">
            <Badge variant="secondary">Events</Badge>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Wallet balance</CardDescription>
          <CardTitle className="text-3xl">
            {formatPkr(wallet?.walletBalance ?? user?.walletBalance ?? 0)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              inputMode="numeric"
              placeholder="Amount PKR"
            />
            <Button onClick={() => void topUp()} disabled={busy}>
              {busy ? '…' : 'Top up'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mock top-up — balance can be used as payment when booking.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Loyalty</CardDescription>
          <CardTitle className="text-3xl">
            {loyalty?.loyaltyPoints ?? user?.loyaltyPoints ?? 0}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            Tier {loyalty?.loyaltyTier ?? user?.loyaltyTier ?? 'BRONZE'}
            {loyalty?.nextTier
              ? ` · ${loyalty.pointsToNext} pts to ${loyalty.nextTier}`
              : ' · Max tier'}
          </p>
          {(loyalty?.recent ?? []).slice(0, 3).map((t) => (
            <p key={t.id}>
              +{t.points} · {t.reason}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Notifications</CardTitle>
          {notifications.some((n) => !n.readAt) ? (
            <Button size="sm" variant="outline" onClick={() => void markNotificationsRead()}>
              Mark read
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notifications yet — new tournaments and waitlist offers appear here.
            </p>
          ) : (
            notifications.slice(0, 12).map((n) => {
              const tournamentId = tournamentIdFromMeta(n.meta);
              const inner = (
                <>
                  <p className="text-sm font-semibold text-navy">
                    {!n.readAt ? (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />
                    ) : null}
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  {tournamentId ? (
                    <p className="mt-1 text-xs font-medium text-brand">View event →</p>
                  ) : null}
                </>
              );
              return (
                <div key={n.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                  {tournamentId ? (
                    <Link href={`/events/${tournamentId}`} className="block hover:opacity-90">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-brand">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          clearSession();
          router.replace('/login');
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
