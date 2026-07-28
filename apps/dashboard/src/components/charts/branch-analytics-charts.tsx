'use client';

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
import type { AnalyticsDto } from '@playpk/shared-types';
import { formatPkr } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  analytics: AnalyticsDto;
  revenueChart: Array<{ month: string; revenue: number }>;
};

export function BranchAnalyticsCharts({ analytics, revenueChart }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Revenue + next-month forecast</CardTitle>
          <CardDescription>
            Linear trend on last 3 months · forecast {formatPkr(analytics.forecast.revenue)} (
            {analytics.forecast.nextMonth})
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
  );
}
