import { supabase } from './client';
import type { AvatarType } from '../../types';

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
