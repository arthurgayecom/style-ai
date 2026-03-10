import { getItem, setItem } from '@/lib/storage/localStorage';

interface ActivityLog {
  dates: string[]; // ISO date strings (YYYY-MM-DD)
}

export function recordActivity() {
  const today = new Date().toISOString().slice(0, 10);
  const log = getItem<ActivityLog>('activity_log', { dates: [] });
  if (!log.dates.includes(today)) {
    log.dates.push(today);
    // Keep last 90 days only
    if (log.dates.length > 90) log.dates = log.dates.slice(-90);
    setItem('activity_log', log);
  }
}

export function getDayStreak(): number {
  const log = getItem<ActivityLog>('activity_log', { dates: [] });
  if (log.dates.length === 0) return 0;

  const sorted = [...log.dates].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);

  // If not active today, check if yesterday counts
  if (sorted[0] !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (sorted[0] !== yesterday) return 0;
  }

  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = new Date(sorted[i]);
    const prev = new Date(sorted[i + 1]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
    if (Math.round(diffDays) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function getWeeklyActivity(): number[] {
  const log = getItem<ActivityLog>('activity_log', { dates: [] });
  const result: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    result.push(log.dates.includes(date) ? 1 : 0);
  }
  return result;
}
