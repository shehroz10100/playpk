describe('Phase2 security: CORS allowlist', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalCors = process.env.CORS_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalCors === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCors;
    jest.resetModules();
  });

  function invokeOrigin(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originFn: (origin: string | undefined, cb: (err: Error | null, allow?: any) => void) => void,
    origin: string | undefined,
  ): Promise<{ err: Error | null; allow?: boolean }> {
    return new Promise((resolve) => {
      originFn(origin, (err, allow) => resolve({ err, allow: Boolean(allow) }));
    });
  }

  it('blocks unknown origins in production when CORS_ORIGINS set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://playpk.vercel.app';
    process.env.ALLOW_MOCK_PAYMENTS = 'false';
    jest.resetModules();
    const { buildCorsOptions } = await import('../cors');
    const opts = buildCorsOptions();
    expect(typeof opts.origin).toBe('function');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originFn = opts.origin as any;
    const blocked = await invokeOrigin(originFn, 'https://evil.example');
    expect(blocked.err).toBeTruthy();
    const allowed = await invokeOrigin(originFn, 'https://playpk.vercel.app');
    expect(allowed.err).toBeNull();
    expect(allowed.allow).toBe(true);
  });

  it('allows requests with no Origin (server-side) in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://playpk.vercel.app';
    process.env.ALLOW_MOCK_PAYMENTS = 'false';
    jest.resetModules();
    const { buildCorsOptions } = await import('../cors');
    const opts = buildCorsOptions();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originFn = opts.origin as any;
    const result = await invokeOrigin(originFn, undefined);
    expect(result.err).toBeNull();
    expect(result.allow).toBe(true);
  });

  it('reflects any origin in non-production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CORS_ORIGINS = '';
    jest.resetModules();
    const { buildCorsOptions } = await import('../cors');
    const opts = buildCorsOptions();
    expect(opts.origin).toBe(true);
  });
});

describe('Phase2 security: rate limit middleware exports', () => {
  it('exports auth and otp limiters', async () => {
    const mod = await import('../../middleware/rate-limit');
    expect(typeof mod.authRateLimiter).toBe('function');
    expect(typeof mod.otpRequestRateLimiter).toBe('function');
    expect(typeof mod.otpVerifyRateLimiter).toBe('function');
  });
});
