import { MockLlmProvider } from '../MockLlmProvider';

describe('MockLlmProvider location keywords', () => {
  const llm = new MockLlmProvider();

  it('detects Johar Town + Padel', async () => {
    const intent = await llm.parseAvailabilityIntent(
      'is there any padel court near johar town',
      '2026-07-15',
    );
    expect(intent.sport).toBe('Padel');
    expect(intent.area).toBe('Johar Town');
    expect(intent.city).toBe('Lahore');
  });

  it('detects DHA Phase areas', async () => {
    const intent = await llm.parseAvailabilityIntent(
      'Is padel available tomorrow evening in DHA?',
      '2026-07-15',
    );
    expect(intent.sport).toBe('Padel');
    expect(intent.area).toBe('DHA');
    expect(intent.date).toBe('2026-07-16');
    expect(intent.timeFrom).toBe('17:00');
  });
});
