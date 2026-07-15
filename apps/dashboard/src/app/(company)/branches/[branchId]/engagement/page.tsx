'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { BranchReviewsDto, WaitlistEntryDto } from '@playpk/shared-types';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function BranchEngagementPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const [reviews, setReviews] = useState<BranchReviewsDto | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<BranchReviewsDto>(`/api/reviews/branches/${branchId}`),
      api<WaitlistEntryDto[]>(`/api/waitlist/branches/${branchId}`),
    ])
      .then(([r, w]) => {
        setReviews(r.data);
        setWaitlist(w.data);
      })
      .catch((err: Error) => setError(err.message));
  }, [branchId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Reviews & waitlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Player ratings and the queue for fully booked slots.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Average rating</CardDescription>
            <CardTitle className="text-3xl text-brand">
              {reviews?.avgRating != null ? `${reviews.avgRating.toFixed(1)}★` : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {reviews?.reviewCount ?? 0} reviews
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Waitlist depth</CardDescription>
            <CardTitle className="text-3xl">{waitlist.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Oldest entry is promoted automatically when a booking cancels.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(reviews?.reviews ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            reviews!.reviews.map((r) => (
              <div key={r.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-navy">{r.user.name}</span>
                  <Badge variant="success">{r.rating}★</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.comment || 'No comment'}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waitlist queue</CardTitle>
          <CardDescription>FIFO by join time</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Court</th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No one on the waitlist.
                  </td>
                </tr>
              ) : (
                waitlist.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy">{entry.user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.user.email ?? entry.user.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">{entry.slot.court.name}</td>
                    <td className="px-4 py-3">
                      <div>{String(entry.slot.date).slice(0, 10)}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.slot.startTime}–{entry.slot.endTime}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
