/**
 * Phase 1 security checks — mock payments / free wallet top-up.
 */
describe('Phase1 security: mock payments & wallet top-up', () => {
  const originalEnv = process.env.ALLOW_MOCK_PAYMENTS;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ALLOW_MOCK_PAYMENTS;
    else process.env.ALLOW_MOCK_PAYMENTS = originalEnv;
    jest.resetModules();
  });

  it('blocks mock charge when ALLOW_MOCK_PAYMENTS=false', async () => {
    process.env.ALLOW_MOCK_PAYMENTS = 'false';
    jest.resetModules();
    const { MockPaymentProvider: Provider } = await import('../MockPaymentProvider');
    const provider = new Provider();
    await expect(
      provider.createPaymentIntent({
        amount: 500,
        currency: 'PKR',
        bookingId: 'b1',
        userId: 'u1',
        method: 'mock',
      }),
    ).rejects.toMatchObject({ code: 'MOCK_PAYMENTS_DISABLED', statusCode: 403 });
  });

  it('allows mock charge when ALLOW_MOCK_PAYMENTS=true', async () => {
    process.env.ALLOW_MOCK_PAYMENTS = 'true';
    jest.resetModules();
    const { MockPaymentProvider: Provider } = await import('../MockPaymentProvider');
    const provider = new Provider();
    const intent = await provider.createPaymentIntent({
      amount: 500,
      currency: 'PKR',
      bookingId: 'b1',
      userId: 'u1',
      method: 'mock',
    });
    expect(intent.status).toBe('succeeded');
  });

  it('blocks self-serve topUpWallet when mock payments disabled', async () => {
    process.env.ALLOW_MOCK_PAYMENTS = 'false';
    jest.resetModules();
    const { topUpWallet: topUp } = await import('../../wallet.service');
    const db = {
      user: { update: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };
    await expect(topUp(db as never, { userId: 'u1', amount: 1000 })).rejects.toMatchObject({
      code: 'MOCK_PAYMENTS_DISABLED',
      statusCode: 403,
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('allows admin topUpWallet when mock payments disabled', async () => {
    process.env.ALLOW_MOCK_PAYMENTS = 'false';
    jest.resetModules();
    const { topUpWallet: topUp } = await import('../../wallet.service');
    const db = {
      user: {
        update: jest.fn().mockResolvedValue({ walletBalance: 1500 }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const result = await topUp(db as never, {
      userId: 'u1',
      amount: 500,
      asAdmin: true,
    });
    expect(result.toppedUp).toBe(500);
    expect(db.user.update).toHaveBeenCalled();
  });
});
