'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AnalyticsDto, BranchTodayStats, PricingSuggestResponse } from '@playpk/shared-types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  company: { id: string; name: string };
  courts: Array<{ id: string; name: string; sport: { name: string } }>;
};

export default function BranchHomePage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [branch, setBranch] = useState<Branch | null>(null);
  const [stats, setStats] = useState<BranchTodayStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsDto | null>(null);
  const [pricing, setPricing] = useState<PricingSuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Branch>(`/api/branches/${branchId}`),
      api<BranchTodayStats>(`/api/branches/${branchId}/stats/today`),
      api<AnalyticsDto>(`/api/ai/analytics?branchId=${branchId}`),
    ])
      .then(([branchRes, statsRes, analyticsRes]) => {
        setBranch(branchRes.data);
        setStats(statsRes.data);
        setAnalytics(analyticsRes.data);
      })
      .catch((err: Error) => setError(err.message));
  }, [branchId]);

  async function loadPricing() {
    if (!branch?.courts[0]) return;
    setPricingBusy(true);
    try {
      const { data } = await api<PricingSuggestResponse>('/api/ai/pricing/suggest', {
        method: 'POST',
        body: JSON.stringify({ courtId: branch.courts[0].id }),
      });
      setPricing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pricing failed');
    } finally {
      setPricingBusy(false);
    }
  }

  if (error && !branch) return <p className="text-sm text-red-600">{error}</p>;
  if (!branch || !stats) return <p className="text-sm text-muted-foreground">Loading branch…</p>;

  const revenueChart = [
    ...(analytics?.revenueByMonth ?? []),
    ...(analytics
      ? [{ month: analytics.forecast.nextMonth, revenue: analytics.forecast.revenue, forecast: true }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-brand">
            {branch.company.name}
          </div>
          <h1 className="text-2xl font-semibold text-navy">{branch.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {branch.address}, {branch.city}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/companies/${branch.company.id}`}
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3 text-sm text-navy hover:bg-muted"
          >
            All branches
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Today&apos;s occupancy</CardDescription>
            <CardTitle className="text-3xl text-brand">{stats.occupancyPercent}%</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats.bookedSlots} booked / {stats.totalSlots} slots
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Today&apos;s revenue</CardDescription>
            <CardTitle className="text-3xl">{formatPkr(stats.revenue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Confirmed paid bookings for {stats.date}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Courts</CardDescription>
            <CardTitle className="text-3xl">{branch.courts.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[...new Set(branch.courts.map((c) => c.sport.name))].map((sport) => (
              <Badge key={sport} variant="success">
                {sport}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      {analytics ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>90-day revenue</CardDescription>
                <CardTitle className="text-2xl">
                  {formatPkr(analytics.summary.revenue)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Occupancy</CardDescription>
                <CardTitle className="text-2xl">{analytics.summary.occupancyPercent}%</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cancellation rate</CardDescription>
                <CardTitle className="text-2xl">{analytics.summary.cancellationRate}%</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Returning customers</CardDescription>
                <CardTitle className="text-2xl">
                  {analytics.summary.returningCustomers}
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    / {analytics.summary.uniqueCustomers}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue + next-month forecast</CardTitle>
                <CardDescription>
                  Linear trend on last 3 months · forecast{' '}
                  {formatPkr(analytics.forecast.revenue)} ({analytics.forecast.nextMonth})
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatPkr(Number(v ?? 0))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue (PKR)"
                      stroke="#00A651"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak hours</CardTitle>
                <CardDescription>
                  Top sport: {analytics.summary.topSport ?? '—'}
                  {analytics.summary.topBranch
                    ? ` · Top branch: ${analytics.summary.topBranch.name}`
                    : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.peakHours.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="bookings" name="Bookings" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>AI price suggestions</CardTitle>
            <CardDescription>
              Rules-based heuristic (+20% weekend, +30% holiday, +15% peak 6–9PM). Model is
              swappable for ML later.
            </CardDescription>
          </div>
          <Button onClick={loadPricing} disabled={pricingBusy || !branch.courts[0]}>
            {pricingBusy ? 'Calculating…' : `Suggest for ${branch.courts[0]?.name ?? 'court'}`}
          </Button>
        </CardHeader>
        <CardContent>
          {!pricing ? (
            <p className="text-sm text-muted-foreground">
              Run suggestions to preview recommended slot prices for the next week.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <p className="mb-3 text-xs text-muted-foreground">
                Model {pricing.model} · {pricing.suggestions.length} slots · hist avg paid{' '}
                {pricing.historicalAvgPaidPrice != null
                  ? formatPkr(pricing.historicalAvgPaidPrice)
                  : '—'}
              </p>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Slot</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">Suggested</th>
                    <th className="px-3 py-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.suggestions.slice(0, 12).map((s) => (
                    <tr key={s.slotId} className="border-t border-border">
                      <td className="px-3 py-2">
                        {s.date} {s.startTime}–{s.endTime}
                      </td>
                      <td className="px-3 py-2">{formatPkr(s.currentPrice)}</td>
                      <td className="px-3 py-2 font-medium text-brand">
                        {formatPkr(s.suggestedPrice)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.reasons.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Jump into day-to-day operations for this branch.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href={`/branches/${branchId}/courts`}
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            Manage courts
          </Link>
          <Link
            href={`/branches/${branchId}/slots`}
            className="inline-flex h-10 items-center rounded-md bg-navy px-4 text-sm font-medium text-white hover:bg-navy-700"
          >
            Slot calendar
          </Link>
          <Link
            href={`/branches/${branchId}/bookings`}
            className="inline-flex h-10 items-center rounded-md border border-border bg-white px-4 text-sm font-medium text-navy hover:bg-muted"
          >
            Bookings &amp; payment proofs
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
