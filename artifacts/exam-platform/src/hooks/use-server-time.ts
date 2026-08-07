import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { useState, useEffect } from 'react';

export function useServerTime() {
  return useQuery({
    queryKey: ['/api/v1/time'],
    queryFn: async () => {
      const res = await customFetch<{ time: string }>('/api/v1/time');
      return new Date(res.time).getTime();
    },
    staleTime: 300000, // 5 minutes cache
    refetchInterval: 300000,
  });
}

export function useSyncedNow(serverTime?: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!serverTime) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }

    const clientTimeAtLoad = Date.now();
    const offset = serverTime - clientTimeAtLoad;

    // Set initial value immediately
    setNow(Date.now() + offset);

    const interval = setInterval(() => {
      setNow(Date.now() + offset);
    }, 1000);

    return () => clearInterval(interval);
  }, [serverTime]);

  return now;
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return { days: '00', hours: '00', minutes: '00', seconds: '00', totalSeconds: 0 };
  
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / (60 * 60)) % 24);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));

  const pad = (num: number) => String(num).padStart(2, '0');

  return {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    totalSeconds
  };
}

export function formatHms(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / (60 * 60)));

  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatRemainingTime(seconds: number) {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (num: number) => String(num).padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function formatExamDateTime(isoString?: string | null) {
  if (!isoString) return { dateStr: '—', timeStr: '—' };
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  // Format parts in UTC to align with ISO UTC string representation saved by admin panel
  const dateStr = date.toLocaleDateString('en-US', {
    ...options,
    hour: undefined,
    minute: undefined
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    ...options,
    day: undefined,
    month: undefined,
    year: undefined
  });
  
  return { dateStr, timeStr };
}
