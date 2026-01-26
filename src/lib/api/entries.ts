import { supabase } from './client';
import type { HabitEntry } from '../../types';
import { calculateTotalScore } from '../scoring';
import { checkNewBadges } from '../gamification';
import { updateStreak } from './streaks';
import { getUserBadges } from './user';
import { v4 as uuidv4 } from 'uuid';

export function createNewEntry(date: string): HabitEntry {
  return {
    id: uuidv4(),
    date,
    wakeUpTime: null,
    bedTime: null,
    businessMinutes: 0,
    sleepMinutes: 0,
    cleanEating: false,
    exercise: false,
    paradigm: false,
    satisfaction: false,
    dopamineContent: false,
    gaming: false,
    score: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getRecentEntries(userId: string, days: number = 30): Promise<HabitEntry[]> {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const dateStr = date.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', dateStr)
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).map((e: any) => ({
    id: e.id,
    date: e.date,
    wakeUpTime: e.wake_up_time,
    bedTime: e.bed_time,
    businessMinutes: e.business_minutes,
    sleepMinutes: e.sleep_minutes,
    cleanEating: e.clean_eating,
    exercise: e.exercise,
    paradigm: (e.paradigm ?? 0) >= 1,
    satisfaction: e.satisfaction,
    dopamineContent: e.dopamine_content,
    gaming: e.gaming,
    approachedGoal: e.reflection_goal,
    businessObstacle: e.reflection_obstacle,
    personalObstacle: e.reflection_personal,
    score: e.score,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));
}

export async function getAllEntries(userId: string): Promise<HabitEntry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).map((e: any) => ({
    id: e.id,
    date: e.date,
    wakeUpTime: e.wake_up_time,
    bedTime: e.bed_time,
    businessMinutes: e.business_minutes,
    sleepMinutes: e.sleep_minutes,
    cleanEating: e.clean_eating,
    exercise: e.exercise,
    paradigm: (e.paradigm ?? 0) >= 1,
    satisfaction: e.satisfaction,
    dopamineContent: e.dopamine_content,
    gaming: e.gaming,
    approachedGoal: e.reflection_goal,
    businessObstacle: e.reflection_obstacle,
    personalObstacle: e.reflection_personal,
    score: e.score,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));
}

export async function getEntryByDate(userId: string, date: string): Promise<HabitEntry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error || !data) return null;

  const d = data as any;

  return {
    id: d.id,
    date: d.date,
    wakeUpTime: d.wake_up_time,
    bedTime: d.bed_time,
    businessMinutes: d.business_minutes,
    sleepMinutes: d.sleep_minutes,
    cleanEating: d.clean_eating,
    exercise: d.exercise,
    paradigm: (d.paradigm ?? 0) >= 1,
    satisfaction: d.satisfaction,
    dopamineContent: d.dopamine_content,
    gaming: d.gaming,
    approachedGoal: d.reflection_goal,
    businessObstacle: d.reflection_obstacle,
    personalObstacle: d.reflection_personal,
    score: d.score,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export async function saveEntry(userId: string, entry: HabitEntry): Promise<void> {
  const score = calculateTotalScore(entry);

  const { error } = await supabase
    .from('entries')
    .upsert({
      id: entry.id,
      user_id: userId,
      date: entry.date,
      wake_up_time: entry.wakeUpTime,
      bed_time: entry.bedTime,
      business_minutes: entry.businessMinutes,
      sleep_minutes: entry.sleepMinutes,
      clean_eating: entry.cleanEating,
      exercise: entry.exercise,
      paradigm: entry.paradigm ? 1 : 0,
      satisfaction: entry.satisfaction,
      dopamine_content: entry.dopamineContent,
      gaming: entry.gaming,
      reflection_goal: entry.approachedGoal,
      reflection_obstacle: entry.businessObstacle,
      reflection_personal: entry.personalObstacle,
      score,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });

  if (error) throw error;

  const streakData = await updateStreak(userId);

  const allEntries = await getAllEntries(userId);
  const existingBadges = await getUserBadges(userId);
  const unlockedBadgeIds = existingBadges.filter(b => b.unlockedAt).map(b => b.id);

  const newBadgeIds = checkNewBadges(entry, allEntries, streakData, unlockedBadgeIds);

  if (newBadgeIds.length > 0) {
    const badgesToInsert = newBadgeIds.map(badgeId => ({
      user_id: userId,
      badge_id: badgeId,
      unlocked_at: new Date().toISOString()
    }));

    await supabase.from('user_badges').insert(badgesToInsert);
  }
}

export async function deleteEntry(userId: string, date: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);

  if (error) throw error;

  await updateStreak(userId);
}

export async function addXpToUser(userId: string, amount: number): Promise<void> {
  const { data: user } = await supabase.from('users').select('total_xp').eq('id', userId).single();
  const currentXp = user?.total_xp || 0;

  await supabase.from('users').update({
    total_xp: currentXp + amount
  }).eq('id', userId);
}

export async function getMonthlyStats(userId: string, year: number, month: number): Promise<{
  entries: HabitEntry[];
  average: number;
  total: number;
  count: number;
  best: number;
}> {
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .like('date', `${monthStr}%`);

  if (error) throw error;

  const entries = (data || []).map((e: any) => ({
    id: e.id,
    date: e.date,
    wakeUpTime: e.wake_up_time,
    bedTime: e.bed_time,
    businessMinutes: e.business_minutes,
    sleepMinutes: e.sleep_minutes,
    cleanEating: e.clean_eating,
    exercise: e.exercise,
    paradigm: (e.paradigm ?? 0) >= 1,
    satisfaction: e.satisfaction,
    dopamineContent: e.dopamine_content,
    gaming: e.gaming,
    score: e.score,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  })) as HabitEntry[];

  if (entries.length === 0) {
    return { entries: [], average: 0, total: 0, count: 0, best: 0 };
  }

  const total = entries.reduce((sum, e) => sum + e.score, 0);
  const best = Math.max(...entries.map(e => e.score));

  return {
    entries,
    average: total / entries.length,
    total,
    count: entries.length,
    best,
  };
}

export async function getWeeklyScores(userId: string, days: number = 7): Promise<{ dates: string[]; scores: number[] }> {
  const entries = await getAllEntries(userId);
  const dates: string[] = [];
  const scores: number[] = [];

  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dates.push(dateStr);

    const entry = entries.find(e => e.date === dateStr);
    scores.push(entry?.score ?? 0);
  }

  return { dates, scores };
}
