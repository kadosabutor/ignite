import type { HabitEntry, RankType, StreakLevel } from '../types';

// Point values (max 100 total)
const POINTS = {
  BUSINESS_MAX: 37,
  BUSINESS_TARGET_MINUTES: 600, // 10 hours
  CLEAN_EATING: 6,
  EXERCISE: 7,
  PARADIGM: 5,
  NO_SATISFACTION: 4,
  NO_DOPAMINE: 3,
  NO_GAMING: 5,
  SLEEP_MAX: 33,
  SLEEP_TARGET_MINUTES: 480, // 8 hours
};

/**
 * Calculate sleep minutes from bed time and wake up time
 */
export function calculateSleepMinutes(bedTime: string | null, wakeUpTime: string | null): number {
  if (!bedTime || !wakeUpTime) return 0;
  
  const [bedHour, bedMin] = bedTime.split(':').map(Number);
  const [wakeHour, wakeMin] = wakeUpTime.split(':').map(Number);
  
  let bedMinutes = bedHour * 60 + bedMin;
  let wakeMinutes = wakeHour * 60 + wakeMin;
  
  // If bed time is in the evening (after 12:00), assume it's the previous day
  if (bedMinutes > wakeMinutes) {
    // Bed time is PM, wake time is AM (normal case)
    return (24 * 60 - bedMinutes) + wakeMinutes;
  } else {
    // Both times are on the same day (nap or unusual schedule)
    return wakeMinutes - bedMinutes;
  }
}

/**
 * Calculate business points (max 37)
 */
export function calculateBusinessPoints(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes >= POINTS.BUSINESS_TARGET_MINUTES) return POINTS.BUSINESS_MAX;
  return (minutes / POINTS.BUSINESS_TARGET_MINUTES) * POINTS.BUSINESS_MAX;
}

/**
 * Calculate sleep points (max 33)
 */
export function calculateSleepPoints(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes >= POINTS.SLEEP_TARGET_MINUTES) return POINTS.SLEEP_MAX;
  return (minutes / POINTS.SLEEP_TARGET_MINUTES) * POINTS.SLEEP_MAX;
}

/**
 * Calculate total score for an entry
 */
export function calculateTotalScore(entry: Partial<HabitEntry>): number {
  let score = 0;
  
  // Business points (max 37)
  score += calculateBusinessPoints(entry.businessMinutes ?? 0);
  
  // Sleep points (max 33)
  score += calculateSleepPoints(entry.sleepMinutes ?? 0);
  
  // Clean eating (6 points)
  if (entry.cleanEating) score += POINTS.CLEAN_EATING;
  
  // Exercise (7 points)
  if (entry.exercise) score += POINTS.EXERCISE;
  
  // Paradigm (5 points if at least 1)
  if ((entry.paradigm ?? 0) >= 1) score += POINTS.PARADIGM;
  
  // No satisfaction (4 points)
  if (!entry.satisfaction) score += POINTS.NO_SATISFACTION;
  
  // No dopamine content (3 points)
  if (!entry.dopamineContent) score += POINTS.NO_DOPAMINE;
  
  // No gaming (5 points)
  if (!entry.gaming) score += POINTS.NO_GAMING;
  
  return Math.min(100, Math.round(score * 100) / 100);
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 90) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

/**
 * Get score label based on value
 */
export function getScoreLabel(score: number): string {
  if (score >= 95) return 'Kiváló';
  if (score >= 90) return 'Nagyszerű';
  if (score >= 80) return 'Jó';
  if (score >= 70) return 'Megfelelő';
  if (score >= 50) return 'Fejleszthető';
  return 'Gyenge';
}

/**
 * Get rank based on 30-day average score
 */
export function getRankFromScore(averageScore: number): RankType {
  if (averageScore >= 99) return 'titan';
  if (averageScore >= 90) return 'monkmode';
  if (averageScore >= 80) return 'highperformer';
  if (averageScore >= 70) return 'operator';
  if (averageScore >= 50) return 'grinder';
  return 'sleepwalker';
}

/**
 * Get streak level based on days
 */
export function getStreakLevel(days: number, isFrozen: boolean = false, isPhoenix: boolean = false): StreakLevel {
  if (isPhoenix) return 'phoenix';
  if (isFrozen || days === 0) return 'frozen';
  if (days >= 91) return 'plasma';
  if (days >= 31) return 'inferno';
  if (days >= 8) return 'blaze';
  return 'spark';
}

/**
 * Calculate radar stats for VS mode (0-100 scale)
 */
export function calculateRadarStats(entries: HabitEntry[]): {
  business: number;
  discipline: number;
  body: number;
  mind: number;
  sleep: number;
} {
  if (entries.length === 0) {
    return { business: 0, discipline: 0, body: 0, mind: 0, sleep: 0 };
  }
  
  const avgBusinessMinutes = entries.reduce((sum, e) => sum + e.businessMinutes, 0) / entries.length;
  const avgSleepMinutes = entries.reduce((sum, e) => sum + e.sleepMinutes, 0) / entries.length;
  const cleanDays = entries.filter(e => !e.satisfaction && !e.dopamineContent && !e.gaming).length;
  const exerciseDays = entries.filter(e => e.exercise).length;
  const cleanEatingDays = entries.filter(e => e.cleanEating).length;
  const paradigmDays = entries.filter(e => e.paradigm >= 1).length;
  
  return {
    business: Math.min(100, (avgBusinessMinutes / POINTS.BUSINESS_TARGET_MINUTES) * 100),
    discipline: (cleanDays / entries.length) * 100,
    body: ((exerciseDays + cleanEatingDays) / (entries.length * 2)) * 100,
    mind: (paradigmDays / entries.length) * 100,
    sleep: Math.min(100, (avgSleepMinutes / POINTS.SLEEP_TARGET_MINUTES) * 100),
  };
}

/**
 * Format minutes to hours and minutes string
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}p`;
  if (mins === 0) return `${hours}ó`;
  return `${hours}ó ${mins}p`;
}

/**
 * Check if a date string is today
 */
export function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

/**
 * Get today's date string
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if current time is past the 04:00 cutoff for the previous day
 */
export function isPastCutoff(): boolean {
  const now = new Date();
  return now.getHours() >= 4;
}

/**
 * Get the effective date for logging (accounts for 04:00 cutoff)
 */
export function getEffectiveDate(): string {
  const now = new Date();
  if (now.getHours() < 4) {
    // Before 4 AM, we're still logging for yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}
