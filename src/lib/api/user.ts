import { supabase } from './client';
import type { UserProfile, AvatarType, RankType, Badge } from '../../types';
import { BADGES } from '../gamification';

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
