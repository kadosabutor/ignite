import { createClient } from '@supabase/supabase-js';
import type { HabitEntry, UserProfile, Friend, StreakData, NotificationSettings, AvatarType, RankType, Badge } from '../types';
import { calculateTotalScore, getRankFromScore, getStreakLevel, getTodayString } from './scoring';
import { checkNewBadges, BADGES } from './gamification';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ============ UTILS ============

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

// ============ AUTH ============

export async function signUp(email: string, password: string, username: string, displayName: string, avatar: AvatarType) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Regisztráció sikertelen');

  const { error: profileError } = await supabase.from('users').insert({
    id: data.user.id,
    email,
    username,
    display_name: displayName,
    avatar,
    rank: 'sleepwalker',
    monthly_average: 0,
    total_xp: 0, 
  });

  if (profileError) throw profileError;

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
    totalXp: userData.total_xp || 0, 
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

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const { data: oldFiles } = await supabase.storage
    .from('avatars')
    .list('', { search: userId });

  if (oldFiles && oldFiles.length > 0) {
    const filesToRemove = oldFiles.map(x => x.name);
    await supabase.storage
      .from('avatars')
      .remove(filesToRemove);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  return data.publicUrl;
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
    totalXp: u.total_xp || 0,
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

// ============ BADGES ============

export async function getUserBadges(userId: string): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('badge_id, unlocked_at')
    .eq('user_id', userId);

  if (error) throw error;

  return BADGES.map(badgeDef => {
    const unlocked = data?.find(b => b.badge_id === badgeDef.id);
    return {
      ...badgeDef,
      unlockedAt: unlocked ? unlocked.unlocked_at : undefined
    };
  });
}

// ============ ENTRIES & SAVING LOGIC ============

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
        monthly_average,
        total_xp
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'connected');

  if (error) throw error;

  const friends: Friend[] = [];

  for (const f of data || []) {
    const friend = f.friend as any;
    if (!friend) continue;

    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', friend.id)
      .single();

    const { data: todayEntry } = await supabase
      .from('entries')
      .select('score, business_minutes, sleep_minutes, exercise, clean_eating, satisfaction, dopamine_content, gaming, paradigm, updated_at')
      .eq('user_id', friend.id)
      .eq('date', getTodayString())
      .single();

    friends.push({
      id: friend.id,
      username: friend.username,
      displayName: friend.display_name,
      avatar: friend.avatar as AvatarType,
      rank: friend.rank as RankType,
      status: 'connected' as const,
      totalXp: friend.total_xp || 0,
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
      todayEntry: todayEntry ? {
        score: todayEntry.score,
        businessMinutes: todayEntry.business_minutes,
        sleepMinutes: todayEntry.sleep_minutes,
        exercise: todayEntry.exercise,
        cleanEating: todayEntry.clean_eating,
        satisfaction: todayEntry.satisfaction,
        dopamineContent: (todayEntry as any).dopamine_content,
        gaming: todayEntry.gaming,
        paradigm: (todayEntry.paradigm ?? 0) >= 1,
        updatedAt: todayEntry.updated_at,
      } : undefined,
    });
  }

  return friends;
}

export async function addFriend(userId: string, friendUsername: string): Promise<void> {
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

  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendData.id}),and(user_id.eq.${friendData.id},friend_id.eq.${userId})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'connected') {
      throw new Error('Már barátok vagytok');
    } else {
      throw new Error('Barátkérelem már küldve');
    }
  }

  const { error } = await supabase.from('friendships').insert({
    user_id: userId,
    friend_id: friendData.id,
    status: 'pending',
  });

  if (error) throw error;
}

export async function getPendingFriendRequests(userId: string): Promise<{
  incoming: Friend[];
  outgoing: Friend[];
}> {
  const { data: incomingData, error: incomingError } = await supabase
    .from('friendships')
    .select(`
      id,
      status,
      user:user_id (
        id,
        username,
        display_name,
        avatar,
        rank,
        monthly_average,
        total_xp
      )
    `)
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (incomingError) throw incomingError;

  const { data: outgoingData, error: outgoingError } = await supabase
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
        monthly_average,
        total_xp
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (outgoingError) throw outgoingError;

  const incoming: Friend[] = [];
  const outgoing: Friend[] = [];

  for (const f of incomingData || []) {
    const user = f.user as any;
    if (!user) continue;

    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();

    incoming.push({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar as AvatarType,
      rank: user.rank as RankType,
      status: 'pending' as const,
      totalXp: user.total_xp || 0,
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
      todayScore: null,
      todayCompleted: false,
      monthlyAverage: user.monthly_average || 0,
      lastPingedAt: null,
    });
  }

  for (const f of outgoingData || []) {
    const friend = f.friend as any;
    if (!friend) continue;

    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', friend.id)
      .single();

    outgoing.push({
      id: friend.id,
      username: friend.username,
      displayName: friend.display_name,
      avatar: friend.avatar as AvatarType,
      rank: friend.rank as RankType,
      status: 'pending' as const,
      totalXp: friend.total_xp || 0,
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
      todayScore: null,
      todayCompleted: false,
      monthlyAverage: friend.monthly_average || 0,
      lastPingedAt: null,
    });
  }

  return { incoming, outgoing };
}

export async function acceptFriendRequest(userId: string, requesterId: string): Promise<void> {
  const { data: request, error: findError } = await supabase
    .from('friendships')
    .select('id')
    .eq('user_id', requesterId)
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .single();

  if (findError || !request) {
    throw new Error('Barátkérelem nem található');
  }

  const { error: updateError } = await supabase
    .from('friendships')
    .update({ status: 'connected' })
    .eq('id', request.id);

  if (updateError) throw updateError;

  const { error: insertError } = await supabase
    .from('friendships')
    .insert({
      user_id: userId,
      friend_id: requesterId,
      status: 'connected',
    });

  if (insertError) throw insertError;
}

export async function rejectFriendRequest(userId: string, requesterId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', requesterId)
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
}

export async function cancelFriendRequest(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .eq('status', 'pending');

  if (error) throw error;
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

  if (error) throw error;
}

export async function getLeaderboard(userId: string, period: 'today' | 'week' | 'month'): Promise<{
  position: number;
  user: { id: string; username: string; displayName: string; avatar: AvatarType; rank: RankType };
  score: number;
  isCurrentUser: boolean;
}[]> {
  const friends = await getAllFriends(userId);
  const friendIds = friends.map(f => f.id);
  friendIds.push(userId);

  let startDate: string;
  const today = getTodayString();

  if (period === 'today') {
    startDate = today;
  } else if (period === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
  } else {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = firstDay.toISOString().split('T')[0];
  }

  const { data: entries, error } = await supabase
    .from('entries')
    .select('user_id, score')
    .in('user_id', friendIds)
    .gte('date', startDate)
    .lte('date', today);

  if (error) throw error;

  const userScores: Record<string, { total: number; count: number }> = {};
  for (const entry of entries || []) {
    if (!userScores[entry.user_id]) {
      userScores[entry.user_id] = { total: 0, count: 0 };
    }
    userScores[entry.user_id].total += entry.score;
    userScores[entry.user_id].count++;
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name, avatar, rank')
    .in('id', friendIds);

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

  leaderboard.sort((a, b) => b.score - a.score);

  return leaderboard.map((entry, index) => ({
    position: index + 1,
    ...entry,
  }));
}

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const { data } = await supabase
    .from('settings')
    .select('notifications')
    .eq('user_id', userId)
    .single();

  const defaults: NotificationSettings = {
    enabled: true,
    morningEnabled: true,
    afternoonEnabled: true,
    eveningEnabled: true,
    streakEnabled: true,
    socialEnabled: true,
    morningTime: '07:00',
    afternoonTime: '15:00',
    eveningTime: '21:00',
    inputMode: 'wizard' // Default to Wizard view
  };

  return { ...defaults, ...data?.notifications };
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

export function subscribeToFriendships(userId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`friendships:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friendships',
      filter: `user_id=eq.${userId}`,
    }, callback)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friendships',
      filter: `friend_id=eq.${userId}`,
    }, callback)
    .subscribe();
}

export async function getFriendEntries(friendId: string, days: number = 30): Promise<HabitEntry[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', friendId)
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .order('date', { ascending: true });

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
    score: e.score,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  })) as HabitEntry[];
}

export async function savePushSubscription(subscription: any) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const subscriptionData = subscription.toJSON ? subscription.toJSON() : subscription;

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: subscriptionData.endpoint,
    p256dh: subscriptionData.keys.p256dh,
    auth: subscriptionData.keys.auth,
  }, {
    onConflict: 'endpoint',
  });

  if (error) throw error;
}

export async function getPushSubscriptions() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;
  return data || [];
}

export async function deletePushSubscription(endpoint: string) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) throw error;
}

export async function getNotifications(limit: number = 20) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function getUnreadNotificationCount() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}

export async function sendPushNotification(
  recipientUserId: string,
  title: string,
  body: string,
  type: string = 'general',
  data?: Record<string, any>
) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) throw new Error('User not authenticated');

  const response = await fetch(
    'https://thibewmulezvjenwowmh.supabase.co/functions/v1/send-push',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        recipientUserId,
        title,
        body,
        data: { type, ...data },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Push notification failed: ${error}`);
  }

  return await response.json();
}
