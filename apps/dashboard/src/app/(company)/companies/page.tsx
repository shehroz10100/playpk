'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Company = {
  id: string;
  name: string;
  description: string | null;
  branches: Array<{ id: string; name: string; city: string }>;
};

export default function CompaniesIndexPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Company[]>('/api/companies')
      .then(({ data }) => {
        setCompanies(data);
        if (data.length === 1) {
          router.replace(`/companies/${data[0].id}`);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Your companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a company to manage branches and venue operations.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {companies.map((company) => (
          <Card key={company.id}>
            <CardHeader>
              <CardTitle>{company.name}</CardTitle>
              <CardDescription>{company.description ?? 'No description'}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Badge variant="muted">{company.branches.length} branches</Badge>
              <Link
                href={`/companies/${company.id}`}
                className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
