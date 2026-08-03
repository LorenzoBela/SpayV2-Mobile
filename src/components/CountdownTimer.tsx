import React, { useState, useEffect, memo } from 'react';

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOverdue: boolean;
  isToday?: boolean;
  hasTarget?: boolean;
}

export interface CountdownTimerProps {
  targetDate?: string | Date | null;
  parseDateFn?: (dateStr: string) => Date;
  children: (timeLeft: TimeLeft) => React.ReactNode;
}

function defaultParseUtcDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes('T') || dateStr.endsWith('Z')) {
    return new Date(dateStr);
  }
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function calculateTimeLeft(
  targetDate?: string | Date | null,
  parseDateFn: (dateStr: string) => Date = defaultParseUtcDate
): TimeLeft {
  if (!targetDate) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isOverdue: false,
      isToday: false,
      hasTarget: false,
    };
  }

  const target = typeof targetDate === 'string' ? parseDateFn(targetDate) : targetDate;
  const now = new Date();
  const diff = target.getTime() - now.getTime();

  if (isNaN(target.getTime())) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isOverdue: false,
      isToday: false,
      hasTarget: false,
    };
  }

  if (diff <= 0) {
    const isToday =
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate();

    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isOverdue: !isToday,
      isToday,
      hasTarget: true,
    };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    isOverdue: false,
    isToday: false,
    hasTarget: true,
  };
}

export const CountdownTimer = memo(function CountdownTimer({
  targetDate,
  parseDateFn = defaultParseUtcDate,
  children,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(targetDate, parseDateFn)
  );

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isOverdue: false,
        isToday: false,
        hasTarget: false,
      });
      return;
    }

    const updateTimer = () => {
      setTimeLeft(calculateTimeLeft(targetDate, parseDateFn));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [targetDate, parseDateFn]);

  return <>{children(timeLeft)}</>;
});

export default CountdownTimer;
