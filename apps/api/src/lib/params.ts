import type { Request } from 'express';

/** Normalize Express params (string | string[]) to a single string. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}
