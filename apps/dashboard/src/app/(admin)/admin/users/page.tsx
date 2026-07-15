'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  suspendedAt: string | null;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    const { data } = await api<AdminUser[]>(`/api/admin/users?${params.toString()}`);
    setUsers(data);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function toggleSuspend(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    try {
      const path = user.suspendedAt
        ? `/api/admin/users/${user.id}/unsuspend`
        : `/api/admin/users/${user.id}/suspend`;
      await api(path, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">User management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search accounts and suspend abusers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name, email, phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="PLAYER">Player</option>
            <option value="COMPANY_OWNER">Company owner</option>
            <option value="BRANCH_MANAGER">Branch manager</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button
            onClick={() => load().catch((err: Error) => setError(err.message))}
            variant="secondary"
          >
            Search
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{users.length} results</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-navy">{u.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.email ?? '—'}
                    <br />
                    {u.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="muted">{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.suspendedAt ? (
                      <Badge variant="danger">Suspended</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'ADMIN' ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={u.suspendedAt ? 'outline' : 'danger'}
                        disabled={busyId === u.id}
                        onClick={() => toggleSuspend(u)}
                      >
                        {u.suspendedAt ? 'Unsuspend' : 'Suspend'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
