'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SportDto } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SportFilterRail } from '@/components/sport-filter-rail';

type Report = {
  summary: {
    grossRevenue: number;
    platformCommission: number;
    paidBookings: number;
    cancelledBookings: number;
    users: number;
    approvedCompanies: number;
    pendingCompanies: number;
    openTickets: number;
    currency: string;
  };
  revenueByCompany: Array<{ name: string; revenue: number; commission: number; bookings: number }>;
};

export default function AdminHomePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [sports, setSports] = useState<SportDto[]>([]);
  const [sportFocus, setSportFocus] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Report>('/api/admin/reports'), api<SportDto[]>('/api/sports')])
      .then(([r, s]) => {
        setReport(r.data);
        setSports(s.data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!report) return <p className="text-sm text-muted-foreground">Loading platform overview…</p>;

  const s = report.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue, approvals pipeline, and support load across PlayPK.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Featured sports</CardTitle>
          <CardDescription>
            {sportFocus
              ? `Focused on ${sportFocus} — same catalog used on customer & company apps.`
              : 'Browse every sport with live cover art — same catalog as customer & company apps.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SportFilterRail
            sports={sports}
            value={sportFocus}
            onChange={setSportFocus}
            featuredOnly={false}
            showAll
            size="md"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross revenue</CardDescription>
            <CardTitle className="text-2xl">{formatPkr(s.grossRevenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform commission</CardDescription>
            <CardTitle className="text-2xl text-brand">
              {formatPkr(s.platformCommission)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid bookings</CardDescription>
            <CardTitle className="text-2xl">{s.paidBookings}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open tickets</CardDescription>
            <CardTitle className="text-2xl">{s.openTickets}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>{s.users} total accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/users" className="text-sm font-medium text-brand hover:underline">
              Manage users →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>
              {s.approvedCompanies} approved ·{' '}
              <Badge variant="warn">{s.pendingCompanies} pending</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/companies" className="text-sm font-medium text-brand hover:underline">
              Approvals & commissions →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <CardDescription>Complaint / ticket inbox</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/tickets" className="text-sm font-medium text-brand hover:underline">
              Open inbox →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by company</CardTitle>
          <CardDescription>Last ~90 days paid bookings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {report.revenueByCompany.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid bookings in window.</p>
          ) : (
            report.revenueByCompany.slice(0, 8).map((row) => (
              <div
                key={row.name}
                className="flex flex-col gap-1 border-b border-border py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-navy">{row.name}</span>
                <span className="text-muted-foreground">
                  {formatPkr(row.revenue)} · fee {formatPkr(row.commission)} · {row.bookings}{' '}
                  bookings
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
