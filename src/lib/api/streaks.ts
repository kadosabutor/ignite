import { supabase } from './client';
import type { StreakData } from '../../types';
import { getAllEntries } from './entries';
import { getRankFromScore, getStreakLevel } from '../scoring';

export async function getStreak(userId: string): Promise<StreakData> {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      level: 'frozen',
      cryoFreezeCount: 0,
      lastEntryDate: null,
      phoenixActive: false,
      phoenixDaysRemaining: 0,
      phoenixStartStreak: 0,
    };
  }

  return {
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
    level: data.level,
    cryoFreezeCount: data.cryo_freeze_count,
    lastEntryDate: data.last_entry_date,
    phoenixActive: data.phoenix_active,
    phoenixDaysRemaining: data.phoenix_days_remaining,
    phoenixStartStreak: data.phoenix_start_streak,
  };
}

export async function updateStreak(userId: string): Promise<StreakData> {
  const entries = await getAllEntries(userId);

  if (entries.length === 0) {
    const defaultStreak: StreakData = {
      currentStreak: 0,
      longestStreak: 0,
      level: 'frozen',
      cryoFreezeCount: 0,
      lastEntryDate: null,
      phoenixActive: false,
      phoenixDaysRemaining: 0,
      phoenixStartStreak: 0,
    };

    await supabase.from('streaks').upsert({
      user_id: userId,
      ...defaultStreak,
      current_streak: 0,
      longest_streak: 0,
      cryo_freeze_count: 0,
      last_entry_date: null,
      phoenix_active: false,
      phoenix_days_remaining: 0,
      phoenix_start_streak: 0,
    }, { onConflict: 'user_id' });

    return defaultStreak;
  }

  let streak = 0;
  const now = new Date();
  const effectiveToday = new Date();
  if (now.getHours() < 4) {
    effectiveToday.setDate(effectiveToday.getDate() - 1);
  }
  const effectiveTodayStr = effectiveToday.toISOString().split('T')[0];

  const hasEntryToday = entries.some(e => e.date === effectiveTodayStr);
  let checkDate = new Date(effectiveToday);

  if (!hasEntryToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const entry = entries.find(e => e.date === dateStr);

    if (entry) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  const { data: currentData } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  const longestStreak = Math.max(currentData?.longest_streak || 0, streak);
  const cryoEarned = Math.min(3, Math.floor(streak / 7));
  const level = getStreakLevel(streak, false, currentData?.phoenix_active || false);

  const streakData: StreakData = {
    currentStreak: streak,
    longestStreak,
    level,
    cryoFreezeCount: cryoEarned,
    lastEntryDate: entries[0]?.date || null,
    phoenixActive: currentData?.phoenix_active || false,
    phoenixDaysRemaining: currentData?.phoenix_days_remaining || 0,
    phoenixStartStreak: currentData?.phoenix_start_streak || 0,
  };

  await supabase.from('streaks').upsert({
    user_id: userId,
    current_streak: streakData.currentStreak,
    longest_streak: streakData.longestStreak,
    level: streakData.level,
    cryo_freeze_count: streakData.cryoFreezeCount,
    last_entry_date: streakData.lastEntryDate,
    phoenix_active: streakData.phoenixActive,
    phoenix_days_remaining: streakData.phoenixDaysRemaining,
    phoenix_start_streak: streakData.phoenixStartStreak,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  const currentMonthPrefix = effectiveTodayStr.substring(0, 7);
  const currentMonthEntries = entries.filter(e => e.date.startsWith(currentMonthPrefix));

  if (currentMonthEntries.length > 0) {
    const avg = currentMonthEntries.reduce((sum, e) => sum + e.score, 0) / currentMonthEntries.length;
    const rank = getRankFromScore(avg);

    await supabase.from('users').update({
      monthly_average: Math.round(avg * 10) / 10,
      rank,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
  } else {
    await supabase.from('users').update({
      monthly_average: 0,
      rank: 'sleepwalker',
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
  }

  return streakData;
}
