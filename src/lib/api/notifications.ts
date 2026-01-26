import { supabase } from './client';
import type { NotificationSettings } from '../../types';

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
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
