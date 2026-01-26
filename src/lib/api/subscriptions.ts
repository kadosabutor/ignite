import { supabase } from './client';

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
  if (friendIds.length === 0) {
    return null;
  }
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
