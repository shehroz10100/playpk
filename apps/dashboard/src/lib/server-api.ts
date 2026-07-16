const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };

export async function serverFetch<T>(
  path: string,
  revalidateSeconds = 300,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  const json = (await res.json()) as ApiSuccess<T>;
  return { data: json.data, meta: json.meta };
}
