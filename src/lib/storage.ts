import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import type { HabitEntry, UserProfile, Friend, StreakData, NotificationSettings, AvatarType } from '../types';
import { calculateTotalScore, getRankFromScore, getStreakLevel, getTodayString } from './scoring';

// Initialize localforage instances
const entriesStore = localforage.createInstance({ name: 'ignite', storeName: 'entries' });
const userStore = localforage.createInstance({ name: 'ignite', storeName: 'user' });
const friendsStore = localforage.createInstance({ name: 'ignite', storeName: 'friends' });
const settingsStore = localforage.createInstance({ name: 'ignite', storeName: 'settings' });

// ============ ENTRIES ============

export async function getAllEntries(): Promise<HabitEntry[]> {
  const entries: HabitEntry[] = [];
  await entriesStore.iterate<HabitEntry, void>((value) => {
    entries.push(value);
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getEntryByDate(date: string): Promise<HabitEntry | null> {
  return await entriesStore.getItem<HabitEntry>(date);
}

export async function saveEntry(entry: HabitEntry): Promise<void> {
  entry.score = calculateTotalScore(entry);
  entry.updatedAt = new Date().toISOString();
  await entriesStore.setItem(entry.date, entry);
  
  // Update streak after saving entry
  await updateStreak();
}

export async function deleteEntry(date: string): Promise<void> {
  await entriesStore.removeItem(date);
  await updateStreak();
}

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

// ============ USER PROFILE ============

export async function getUserProfile(): Promise<UserProfile | null> {
  return await userStore.getItem<UserProfile>('profile');
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await userStore.setItem('profile', profile);
}

export async function createUserProfile(username: string, displayName: string, avatar: AvatarType): Promise<UserProfile> {
  const profile: UserProfile = {
    id: uuidv4(),
    username,
    displayName,
    avatar,
    bio: '',
    rank: 'sleepwalker',
    monthlyAverage: 0,
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      level: 'frozen',
      cryoFreezeCount: 0,
      lastEntryDate: null,
      phoenixActive: false,
      phoenixDaysRemaining: 0,
      phoenixStartStreak: 0,
    },
    createdAt: new Date().toISOString(),
  };
  await saveUserProfile(profile);
  return profile;
}

// ============ STREAK ============

export async function getStreak(): Promise<StreakData> {
  const profile = await getUserProfile();
  if (!profile) {
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
  return profile.streak;
}

export async function updateStreak(): Promise<StreakData> {
  const entries = await getAllEntries();
  const profile = await getUserProfile();
  
  if (!profile) {
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
  
  // Sort entries by date descending
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  
  if (sortedEntries.length === 0) {
    profile.streak.currentStreak = 0;
    profile.streak.level = 'frozen';
    await saveUserProfile(profile);
    return profile.streak;
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
    const entry = sortedEntries.find(e => e.date === dateStr);
    
    if (entry) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // Update streak data
  profile.streak.currentStreak = streak;
  profile.streak.longestStreak = Math.max(profile.streak.longestStreak, streak);
  profile.streak.lastEntryDate = sortedEntries[0]?.date || null;
  profile.streak.level = getStreakLevel(streak, false, profile.streak.phoenixActive);
  
  // Award cryo-freeze every 7 days (max 3)
  const cryoEarned = Math.floor(streak / 7);
  profile.streak.cryoFreezeCount = Math.min(3, cryoEarned);
  
  // Update rank based on 30-day average
  const last30Days = sortedEntries.slice(0, 30);
  if (last30Days.length > 0) {
    const avg = last30Days.reduce((sum, e) => sum + e.score, 0) / last30Days.length;
    profile.monthlyAverage = Math.round(avg * 10) / 10;
    profile.rank = getRankFromScore(avg);
  }
  
  await saveUserProfile(profile);
  return profile.streak;
}

export async function useCryoFreeze(): Promise<boolean> {
  const profile = await getUserProfile();
  if (!profile || profile.streak.cryoFreezeCount <= 0) {
    return false;
  }
  
  profile.streak.cryoFreezeCount--;
  // Streak stays the same, doesn't increase
  await saveUserProfile(profile);
  return true;
}

export async function startPhoenixProtocol(lostStreak: number): Promise<boolean> {
  const profile = await getUserProfile();
  if (!profile || lostStreak < 10) {
    return false;
  }
  
  profile.streak.phoenixActive = true;
  profile.streak.phoenixDaysRemaining = 3;
  profile.streak.phoenixStartStreak = lostStreak;
  profile.streak.level = 'phoenix';
  await saveUserProfile(profile);
  return true;
}

export async function checkPhoenixProgress(todayScore: number): Promise<'success' | 'fail' | 'continue' | null> {
  const profile = await getUserProfile();
  if (!profile || !profile.streak.phoenixActive) {
    return null;
  }
  
  if (todayScore < 80) {
    // Failed the trial
    profile.streak.phoenixActive = false;
    profile.streak.phoenixDaysRemaining = 0;
    profile.streak.currentStreak = 0;
    profile.streak.level = 'frozen';
    await saveUserProfile(profile);
    return 'fail';
  }
  
  profile.streak.phoenixDaysRemaining--;
  
  if (profile.streak.phoenixDaysRemaining <= 0) {
    // Completed the trial!
    profile.streak.phoenixActive = false;
    profile.streak.currentStreak = profile.streak.phoenixStartStreak + 3;
    profile.streak.level = getStreakLevel(profile.streak.currentStreak);
    await saveUserProfile(profile);
    return 'success';
  }
  
  await saveUserProfile(profile);
  return 'continue';
}

// ============ FRIENDS ============

export async function getAllFriends(): Promise<Friend[]> {
  const friends: Friend[] = [];
  await friendsStore.iterate<Friend, void>((value) => {
    friends.push(value);
  });
  return friends;
}

export async function addFriend(friend: Friend): Promise<void> {
  await friendsStore.setItem(friend.id, friend);
}

export async function removeFriend(friendId: string): Promise<void> {
  await friendsStore.removeItem(friendId);
}

export async function updateFriend(friend: Friend): Promise<void> {
  await friendsStore.setItem(friend.id, friend);
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

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const settings = await settingsStore.getItem<NotificationSettings>('notifications');
  return settings || DEFAULT_NOTIFICATION_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await settingsStore.setItem('notifications', settings);
}

// ============ STATS ============

export async function getMonthlyStats(year: number, month: number): Promise<{
  entries: HabitEntry[];
  average: number;
  total: number;
  count: number;
  best: number;
}> {
  const entries = await getAllEntries();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
  
  if (monthEntries.length === 0) {
    return { entries: [], average: 0, total: 0, count: 0, best: 0 };
  }
  
  const total = monthEntries.reduce((sum, e) => sum + e.score, 0);
  const best = Math.max(...monthEntries.map(e => e.score));
  
  return {
    entries: monthEntries,
    average: total / monthEntries.length,
    total,
    count: monthEntries.length,
    best,
  };
}

export async function getWeeklyScores(days: number = 7): Promise<{ dates: string[]; scores: number[] }> {
  const entries = await getAllEntries();
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
