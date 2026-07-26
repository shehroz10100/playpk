describe('Phase3 security: OTP must not leak codes in production', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.dontMock('../redis');
    jest.dontMock('../sms');
    jest.dontMock('../../config/env');
  });

  it('does not console.log full OTP when Twilio sends in production', async () => {
    jest.resetModules();
    jest.doMock('../../config/env', () => ({
      appConfig: {
        isProd: true,
        isDev: false,
        isTest: false,
        allowMockPayments: false,
        sms: {
          twilio: {
            accountSid: 'ACtest',
            authToken: 'token',
            fromNumber: '+12025550123',
            messagingServiceSid: '',
          },
        },
      },
    }));
    jest.doMock('../redis', () => ({
      redis: {
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        get: jest.fn(),
        multi: jest.fn(),
      },
    }));
    jest.doMock('../sms', () => ({
      sendSms: jest.fn().mockResolvedValue({ provider: 'twilio' }),
    }));

    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { issueOtp } = await import('../otp');
    const result = await issueOtp('+923001234567');

    expect(result.code).toBeUndefined();
    const joined = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(joined).not.toMatch(/OTP for \+923001234567: \d{6}/);
    expect(joined).toMatch(/OTP dispatched for phone ending …4567/);
    log.mockRestore();
  });

  it('fails closed in production when SMS is not configured', async () => {
    jest.resetModules();
    jest.doMock('../../config/env', () => ({
      appConfig: {
        isProd: true,
        isDev: false,
        isTest: false,
        allowMockPayments: false,
        sms: {
          twilio: {
            accountSid: '',
            authToken: '',
            fromNumber: '',
            messagingServiceSid: '',
          },
        },
      },
    }));
    jest.doMock('../redis', () => ({
      redis: {
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        get: jest.fn(),
        multi: jest.fn(),
      },
    }));

    const { issueOtp } = await import('../otp');
    await expect(issueOtp('+923001234567')).rejects.toMatchObject({
      code: 'SMS_NOT_CONFIGURED',
      statusCode: 503,
    });
  });

  it('logs OTP in non-production for local demo', async () => {
    jest.resetModules();
    jest.doMock('../../config/env', () => ({
      appConfig: {
        isProd: false,
        isDev: true,
        isTest: false,
        allowMockPayments: true,
        sms: {
          twilio: {
            accountSid: '',
            authToken: '',
            fromNumber: '',
            messagingServiceSid: '',
          },
        },
      },
    }));
    jest.doMock('../redis', () => ({
      redis: {
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        get: jest.fn(),
        multi: jest.fn(),
      },
    }));

    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { issueOtp } = await import('../otp');
    await issueOtp('+923009998887');

    const joined = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(joined).toMatch(/\[MockSMS\] OTP for \+923009998887: \d{6}/);
    log.mockRestore();
  });
});

describe('Phase3 security: demo logins gated for production UI', () => {
  it('dashboard login gates demo passwords behind non-production / flag', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const file = path.join(
      __dirname,
      '../../../../dashboard/src/app/login/page.tsx',
    );
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('SHOW_DEMO_LOGINS');
    expect(src).toContain("NODE_ENV !== 'production'");
    expect(src).toContain('NEXT_PUBLIC_SHOW_DEMO_LOGINS');
    const withoutDemosBlock = src.replace(/const DEMOS[\s\S]*?:\s*\[\];/, '');
    expect(withoutDemosBlock).not.toContain('PlayPK@player1');
    expect(withoutDemosBlock).not.toContain('PlayPK@admin1');
  });
});
