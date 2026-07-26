declare module 'pg' {
  export class Client {
    constructor(config?: {
      connectionString?: string;
      ssl?: boolean | { rejectUnauthorized?: boolean };
    });
    connect(): Promise<void>;
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
}
