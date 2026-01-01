import { createClient } from '@supabase/supabase-js';
import type { HabitEntry, UserProfile, Friend, StreakData, NotificationSettings, AvatarType, RankType } from '../types';
import { calculateTotalScore, getRankFromScore, getStreakLevel, getTodayString } from './scoring';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============ AUTH ============

export async function signUp(email: string, password: string, username: string, displayName: string, avatar: AvatarType) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  if (!data.user) throw new Error('Regisztráció sikertelen');
  
  // Create user profile
  const { error: profileError } = await supabase.from('users').insert({
    id: data.user.id,
    email,
    username,
    display_name: displayName,
    avatar,
    rank: 'sleepwalker',
    monthly_average: 0,
  });
  
  if (profileError) throw profileError;
  
  // Create streak record
  const { error: streakError } = await supabase.from('streaks').insert({
    user_id: data.user.id,
    current_streak: 0,
    longest_streak: 0,
    level: 'frozen',
    cryo_freeze_count: 0,
  });
  
  if (streakError) throw streakError;
  
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

// ============ USER PROFILE ============

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (userError || !userData) return null;
  
  const { data: streakData } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return {
    id: userData.id,
    username: userData.username,
    displayName: userData.display_name,
    avatar: userData.avatar as AvatarType,
    bio: userData.bio || '',
    rank: userData.rank as RankType,
    monthlyAverage: userData.monthly_average || 0,
    streak: streakData ? {
      currentStreak: streakData.current_streak,
      longestStreak: streakData.longest_streak,
      level: streakData.level,
      cryoFreezeCount: streakData.cryo_freeze_count,
      lastEntryDate: streakData.last_entry_date,
      phoenixActive: streakData.phoenix_active,
      phoenixDaysRemaining: streakData.phoenix_days_remaining,
      phoenixStartStreak: streakData.phoenix_start_streak,
    } : {
      currentStreak: 0,
      longestStreak: 0,
      level: 'frozen',
      cryoFreezeCount: 0,
      lastEntryDate: null,
      phoenixActive: false,
      phoenixDaysRemaining: 0,
      phoenixStartStreak: 0,
    },
    createdAt: userData.created_at,
  };
}

export async function saveUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      display_name: profile.displayName,
      bio: profile.bio,
      avatar: profile.avatar,
      rank: profile.rank,
      monthly_average: profile.monthlyAverage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);
  
  if (error) throw error;
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(20);
  
  if (error) throw error;
  
  return (data || []).map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatar: u.avatar as AvatarType,
    bio: u.bio || '',
    rank: u.rank as RankType,
    monthlyAverage: u.monthly_average || 0,
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      level: 'frozen' as const,
      cryoFreezeCount: 0,
      lastEntryDate: null,
      phoenixActive: false,
      phoenixDaysRemaining: 0,
      phoenixStartStreak: 0,
    },
    createdAt: u.created_at,
  }));
}

// ============ ENTRIES ============

export async function getAllEntries(userId: string): Promise<HabitEntry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(e => ({
    id: e.id,
    date: e.date,
    wakeUpTime: e.wake_up_time,
    bedTime: e.bed_time,
    businessMinutes: e.business_minutes,
    sleepMinutes: e.sleep_minutes,
    cleanEating: e.clean_eating,
    exercise: e.exercise,
    paradigm: e.paradigm,
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
  
  return {
    id: data.id,
    date: data.date,
    wakeUpTime: data.wake_up_time,
    bedTime: data.bed_time,
    businessMinutes: data.business_minutes,
    sleepMinutes: data.sleep_minutes,
    cleanEating: data.clean_eating,
    exercise: data.exercise,
    paradigm: data.paradigm,
    satisfaction: data.satisfaction,
    dopamineContent: data.dopamine_content,
    gaming: data.gaming,
    approachedGoal: data.reflection_goal,
    businessObstacle: data.reflection_obstacle,
    personalObstacle: data.reflection_personal,
    score: data.score,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
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
      paradigm: entry.paradigm,
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
  
  // Update streak after saving
  await updateStreak(userId);
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

// ============ STREAK ============

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
  
  // Calculate current streak
  let streak = 0;
  const today = getTodayString();
  let checkDate = new Date(today);
  
  // Check if we're before 4 AM - if so, yesterday is still valid
  const now = new Date();
  if (now.getHours() < 4) {
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
  
  // Get current streak data
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
  
  // Update user rank based on 30-day average
  const last30Days = entries.slice(0, 30);
  if (last30Days.length > 0) {
    const avg = last30Days.reduce((sum, e) => sum + e.score, 0) / last30Days.length;
    const rank = getRankFromScore(avg);
    
    await supabase.from('users').update({
      monthly_average: Math.round(avg * 10) / 10,
      rank,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
  }
  
  return streakData;
}

// ============ FRIENDS ============

export async function getAllFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      status,
      friend:friend_id (
        id,
        username,
        display_name,
        avatar,
        rank,
        monthly_average
      )
    `)
    .eq('user_id', userId);
  
  if (error) throw error;
  
  const friends: Friend[] = [];
  
  for (const f of data || []) {
    const friend = f.friend as any;
    if (!friend) continue;
    
    // Get friend's streak
    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', friend.id)
      .single();
    
    // Get friend's today entry
    const { data: todayEntry } = await supabase
      .from('entries')
      .select('score')
      .eq('user_id', friend.id)
      .eq('date', getTodayString())
      .single();
    
    friends.push({
      id: friend.id,
      username: friend.username,
      displayName: friend.display_name,
      avatar: friend.avatar as AvatarType,
      rank: friend.rank as RankType,
      status: f.status as 'pending' | 'connected',
      streak: streakData ? {
        currentStreak: streakData.current_streak,
        longestStreak: streakData.longest_streak,
        level: streakData.level,
        cryoFreezeCount: streakData.cryo_freeze_count,
        lastEntryDate: streakData.last_entry_date,
        phoenixActive: streakData.phoenix_active,
        phoenixDaysRemaining: streakData.phoenix_days_remaining,
        phoenixStartStreak: streakData.phoenix_start_streak,
      } : {
        currentStreak: 0,
        longestStreak: 0,
        level: 'frozen',
        cryoFreezeCount: 0,
        lastEntryDate: null,
        phoenixActive: false,
        phoenixDaysRemaining: 0,
        phoenixStartStreak: 0,
      },
      todayScore: todayEntry?.score || null,
      todayCompleted: !!todayEntry,
      monthlyAverage: friend.monthly_average || 0,
      lastPingedAt: null,
    });
  }
  
  return friends;
}

export async function addFriend(userId: string, friendUsername: string): Promise<void> {
  // Find friend by username
  const { data: friendData, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('username', friendUsername)
    .single();
  
  if (findError || !friendData) {
    throw new Error('Felhasználó nem található');
  }
  
  if (friendData.id === userId) {
    throw new Error('Nem adhatod hozzá magadat');
  }
  
  // Check if already friends
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', friendData.id)
    .single();
  
  if (existing) {
    throw new Error('Már barátok vagytok');
  }
  
  // Add friendship (both directions)
  const { error } = await supabase.from('friendships').insert([
    { user_id: userId, friend_id: friendData.id, status: 'connected' },
    { user_id: friendData.id, friend_id: userId, status: 'connected' },
  ]);
  
  if (error) throw error;
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  // Remove both directions
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
  
  if (error) throw error;
}

// ============ LEADERBOARD ============

export async function getLeaderboard(userId: string, period: 'today' | 'week' | 'month'): Promise<{
  position: number;
  user: { id: string; username: string; displayName: string; avatar: AvatarType; rank: RankType };
  score: number;
  isCurrentUser: boolean;
}[]> {
  // Get friends
  const friends = await getAllFriends(userId);
  const friendIds = friends.map(f => f.id);
  friendIds.push(userId); // Include self
  
  // Get entries based on period
  let startDate: string;
  const today = getTodayString();
  
  if (period === 'today') {
    startDate = today;
  } else if (period === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startDate = d.toISOString().split('T')[0];
  }
  
  // Get all entries for the period
  const { data: entries, error } = await supabase
    .from('entries')
    .select('user_id, score')
    .in('user_id', friendIds)
    .gte('date', startDate)
    .lte('date', today);
  
  if (error) throw error;
  
  // Calculate average scores per user
  const userScores: Record<string, { total: number; count: number }> = {};
  for (const entry of entries || []) {
    if (!userScores[entry.user_id]) {
      userScores[entry.user_id] = { total: 0, count: 0 };
    }
    userScores[entry.user_id].total += entry.score;
    userScores[entry.user_id].count++;
  }
  
  // Get user profiles
  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name, avatar, rank')
    .in('id', friendIds);
  
  // Build leaderboard
  const leaderboard = (users || []).map(u => ({
    user: {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatar: u.avatar as AvatarType,
      rank: u.rank as RankType,
    },
    score: userScores[u.id] ? Math.round(userScores[u.id].total / userScores[u.id].count) : 0,
    isCurrentUser: u.id === userId,
  }));
  
  // Sort by score
  leaderboard.sort((a, b) => b.score - a.score);
  
  // Add positions
  return leaderboard.map((entry, index) => ({
    position: index + 1,
    ...entry,
  }));
}

// ============ SETTINGS ============

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  morningEnabled: true,
  afternoonEnabled: true,
  eveningEnabled: true,
  streakEnabled: true,
  socialEnabled: true,
  morningTime: '07:00',
  afternoonTime: '15:00',
  eveningTime: '21:00',
};

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const { data } = await supabase
    .from('settings')
    .select('notifications')
    .eq('user_id', userId)
    .single();
  
  return data?.notifications || DEFAULT_NOTIFICATION_SETTINGS;
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({
      user_id: userId,
      notifications: settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  
  if (error) throw error;
}

// ============ STATS ============

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
  
  const entries = (data || []).map(e => ({
    id: e.id,
    date: e.date,
    wakeUpTime: e.wake_up_time,
    bedTime: e.bed_time,
    businessMinutes: e.business_minutes,
    sleepMinutes: e.sleep_minutes,
    cleanEating: e.clean_eating,
    exercise: e.exercise,
    paradigm: e.paradigm,
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

// ============ REAL-TIME SUBSCRIPTIONS ============

export function subscribeToEntries(userId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`entries:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'entries',
      filter: `user_id=eq.${userId}`,
    }, callback)
    .subscribe();
}

export function subscribeToFriendEntries(friendIds: string[], callback: (payload: any) => void) {
  return supabase
    .channel('friend-entries')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'entries',
      filter: `user_id=in.(${friendIds.join(',')})`,
    }, callback)
    .subscribe();
}
