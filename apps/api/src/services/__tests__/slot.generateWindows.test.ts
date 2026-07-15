import { operatingWindows, slotsForDayWindow } from '../slotHours';

describe('operatingWindows', () => {
  it('builds a single daytime window', () => {
    expect(operatingWindows('06:00', '23:00')).toEqual([
      { start: '06:00', endExclusiveMinutes: 23 * 60 },
    ]);
  });

  it('builds overnight windows for 06:00–04:00', () => {
    expect(operatingWindows('06:00', '04:00')).toEqual([
      { start: '06:00', endExclusiveMinutes: 24 * 60 },
      { start: '00:00', endExclusiveMinutes: 4 * 60 },
    ]);
  });

  it('rejects identical open and close', () => {
    expect(() => operatingWindows('10:00', '10:00')).toThrow(/cannot be the same/i);
  });
});

describe('slotsForDayWindow', () => {
  it('creates hourly overnight morning slots', () => {
    expect(slotsForDayWindow('00:00', 4 * 60, 60)).toEqual([
      { startTime: '00:00', endTime: '01:00' },
      { startTime: '01:00', endTime: '02:00' },
      { startTime: '02:00', endTime: '03:00' },
      { startTime: '03:00', endTime: '04:00' },
    ]);
  });

  it('wraps end time across midnight', () => {
    expect(slotsForDayWindow('23:00', 24 * 60, 60)).toEqual([
      { startTime: '23:00', endTime: '00:00' },
    ]);
  });
});
