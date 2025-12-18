import {
  formatDateForAnaf,
  getCurrentDateForAnaf,
  isValidAnafDateFormat,
  dateToTimestamp,
  getDayRange,
  daysBetween,
  getDaysAgo,
  isValidDaysParameter,
} from '../src/utils/dateUtils';

describe('dateUtils', () => {
  test('formatDateForAnaf accepts YYYY-MM-DD strings', () => {
    expect(formatDateForAnaf('2023-01-02')).toBe('2023-01-02');
  });

  test('formatDateForAnaf formats Date objects', () => {
    const d = new Date('2023-03-05T12:34:56Z');
    expect(formatDateForAnaf(d)).toBe('2023-03-05');
  });

  test('formatDateForAnaf formats timestamp numbers', () => {
    const ts = new Date('2021-07-15T00:00:00Z').getTime();
    expect(formatDateForAnaf(ts)).toBe('2021-07-15');
  });

  test('formatDateForAnaf throws on invalid input', () => {
    expect(() => formatDateForAnaf('not-a-date')).toThrow('Invalid date provided');
  });

  test('getCurrentDateForAnaf returns valid format', () => {
    const cur = getCurrentDateForAnaf();
    expect(isValidAnafDateFormat(cur)).toBe(true);
  });

  test('isValidAnafDateFormat detects valid and invalid strings', () => {
    expect(isValidAnafDateFormat('2020-01-01')).toBe(true);
    expect(isValidAnafDateFormat('01-01-2020')).toBe(false);
  });

  test('dateToTimestamp accepts string and number', () => {
    const ts = dateToTimestamp('2021-01-01T00:00:00Z');
    expect(typeof ts).toBe('number');

    const n = 1609459200000;
    expect(dateToTimestamp(n)).toBe(n);
  });

  test('dateToTimestamp throws on invalid string', () => {
    expect(() => dateToTimestamp('bad')).toThrow('Invalid date provided for timestamp conversion');
  });

  test('getDayRange returns start and end for the whole day', () => {
    const { start, end } = getDayRange('2025-12-15');
    const s = new Date(start);
    const e = new Date(end);

    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getMilliseconds()).toBe(0);

    expect(e.getHours()).toBe(23);
    expect(e.getMinutes()).toBe(59);
    expect(e.getSeconds()).toBe(59);
    expect(e.getMilliseconds()).toBe(999);

    expect(end - start).toBe(24 * 60 * 60 * 1000 - 1);
  });

  test('daysBetween calculates days correctly', () => {
    expect(daysBetween('2025-12-10', '2025-12-12')).toBe(2);
    // reversed order
    expect(daysBetween('2025-12-12', '2025-12-10')).toBe(2);
  });

  test('daysBetween throws on invalid dates', () => {
    expect(() => daysBetween('bad', '2025-12-10')).toThrow('Invalid dates provided for calculation');
  });

  test('getDaysAgo returns a date N days in the past', () => {
    const oneDayAgo = getDaysAgo(1);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - oneDayAgo.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(1);
  });

  test('isValidDaysParameter enforces 1-60 integer bounds', () => {
    expect(isValidDaysParameter(0)).toBe(false);
    expect(isValidDaysParameter(1)).toBe(true);
    expect(isValidDaysParameter(60)).toBe(true);
    expect(isValidDaysParameter(61)).toBe(false);
    expect(isValidDaysParameter(1.5)).toBe(false);
  });
});
