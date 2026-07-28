'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Report = {
  window: { from: string; to: string };
  summary: {
    grossRevenue: number;
    platformCommission: number;
    paidBookings: number;
    cancelledBookings: number;
    totalBookings: number;
    currency: string;
  };
  revenueByCompany: Array<{
    companyId: string;
    name: string;
    revenue: number;
    commission: number;
    bookings: number;
  }>;
  revenueByDay: Array<{ date: string; revenue: number; bookings: number }>;
  recentBookings: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    paymentMethod?: string | null;
    paymentProofUrl?: string | null;
    totalAmount: number;
    createdAt: string;
    user: { name: string };
    branch: string;
    company: string;
    commissionPercent: number;
  }>;
};

export default function AdminReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const { data } = await api<Report>(`/api/admin/reports?${params.toString()}`);
    setReport(data);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Platform reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Booking volume, revenue, and estimated commission across all companies.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={() => load().catch((err: Error) => setError(err.message))}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!report ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Window {report.window.from} → {report.window.to}
          </p>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Gross revenue</CardDescription>
                <CardTitle className="text-2xl">
                  {formatPkr(report.summary.grossRevenue)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Commission</CardDescription>
                <CardTitle className="text-2xl text-brand">
                  {formatPkr(report.summary.platformCommission)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Paid bookings</CardDescription>
                <CardTitle className="text-2xl">{report.summary.paidBookings}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Cancelled</CardDescription>
                <CardTitle className="text-2xl">{report.summary.cancelledBookings}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily revenue</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatPkr(Number(v ?? 0))} />
                    <Line type="monotone" dataKey="revenue" stroke="#00A651" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By company</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.revenueByCompany.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatPkr(Number(v ?? 0))} />
                    <Bar dataKey="revenue" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent bookings</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Venue</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {report.recentBookings.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{b.user.name}</td>
                      <td className="px-4 py-3">
                        {b.company} · {b.branch}
                      </td>
                      <td className="px-4 py-3">
                        {formatPkr(b.totalAmount)}
                        <div className="text-xs text-muted-foreground">
                          fee {b.commissionPercent}%
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="muted">{b.status}</Badge>{' '}
                        <Badge variant="success">{b.paymentStatus}</Badge>
                        {b.paymentMethod ? (
                          <div className="mt-1 text-[10px] text-muted-foreground">{b.paymentMethod}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {b.paymentProofUrl ? (
                          <a href={b.paymentProofUrl} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={b.paymentProofUrl}
                              alt="Proof"
                              className="h-12 w-16 rounded border border-border object-cover"
                            />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
