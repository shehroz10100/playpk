import type { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

type RequestSource = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: RequestSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[source]);
    if (source === 'body') {
      req.body = parsed;
    } else if (source === 'query') {
      // Express query is read-only-ish; attach parsed copy for handlers
      (req as Request & { validatedQuery?: T }).validatedQuery = parsed;
    } else {
      (req as Request & { validatedParams?: T }).validatedParams = parsed;
    }
    next();
  };
}
