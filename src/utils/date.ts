/**
 * Normalizes a date value to UTC.
 * Supabase 'timestamp without time zone' columns return strings like
 * '2026-07-04 16:00:00' with no timezone indicator. JavaScript's new Date()
 * parses these as LOCAL time, causing an 8-hour shift on UTC+8 devices.
 * This helper appends 'Z' to bare timestamp strings so they are parsed as UTC.
 */
export function parseUtcDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (!value) return new Date();

  let s = String(value).trim();
  
  // Replace space with 'T' to standardize on ISO 8601 format
  s = s.replace(' ', 'T');

  // Check if the string already has timezone info (Z, +HH:MM, +HH, +HHMM, -HH:MM, -HH, -HHMM)
  const hasTimezone = /Z$|[+-]\d{2}(?::?\d{2})?$/.test(s);
  
  if (hasTimezone) {
    return new Date(s);
  }
  
  // Bare timestamp — treat as UTC by appending 'Z'
  return new Date(s + 'Z');
}

export function getUtc8DateParts(date: Date | string | number = new Date()) {
  const d = parseUtcDate(date);
  const utc8Time = d.getTime() + 8 * 60 * 60 * 1000;
  const shifted = new Date(utc8Time);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
}

export function createUtc8Date(year: number, month: number, date: number, hours = 0, minutes = 0, seconds = 0, ms = 0): Date {
  const utcTime = Date.UTC(year, month, date, hours, minutes, seconds, ms);
  return new Date(utcTime - 8 * 60 * 60 * 1000);
}

export function getBillingMonthKey(dueDate: Date | string): string {
  const d = parseUtcDate(dueDate);
  const parts = getUtc8DateParts(d);
  if (parts.date >= 5) {
    return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}`;
  }

  const prevParts = getUtc8DateParts(new Date(d.getTime() - 5 * 24 * 60 * 60 * 1000));
  return `${prevParts.year}-${String(prevParts.month + 1).padStart(2, '0')}`;
}

export function getCalendarMonthKey(date: Date | string): string {
  const parts = getUtc8DateParts(parseUtcDate(date));
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}`;
}

export function formatBillingMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getNextCalendarMonthStart(now = new Date()): Date {
  const parts = getUtc8DateParts(now);
  return createUtc8Date(parts.year, parts.month + 1, 1);
}
