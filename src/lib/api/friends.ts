import { supabase } from './client';
import type { Friend, HabitEntry, AvatarType, RankType } from '../../types';
import { getTodayString } from '../scoring';

// This new function will be the optimized way to get friend data.
async function getFriendData(userIds: string[]): Promise<any[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar,
        rank,
        monthly_average,
        total_xp,
        streaks (
          current_streak,
          longest_streak,
          level,
          cryo_freeze_count,
          last_entry_date,
          phoenix_active,
          phoenix_days_remaining,
          phoenix_start_streak
        ),
        entries (
          score,
          business_minutes,
          sleep_minutes,
          exercise,
          clean_eating,
          satisfaction,
          dopamine_content,
          gaming,
          paradigm,
          updated_at
        )
      `)
      .in('id', userIds)
      .eq('entries.date', getTodayString());

    if (error) throw error;
    return data || [];
}

export async function getAllFriends(userId: string): Promise<Friend[]> {
    const { data: friendships, error } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'connected');

    if (error) throw error;

    const friendIds = friendships.map(f => f.friend_id);
    const friendsData = await getFriendData(friendIds);

    return friendsData.map(friend => {
        const streakData = friend.streaks[0] || {};
        const todayEntry = friend.entries[0];

        return {
            id: friend.id,
            username: friend.username,
            displayName: friend.display_name,
            avatar: friend.avatar as AvatarType,
            rank: friend.rank as RankType,
            status: 'connected' as const,
            totalXp: friend.total_xp || 0,
            streak: {
                currentStreak: streakData.current_streak || 0,
                longestStreak: streakData.longest_streak || 0,
                level: streakData.level || 'frozen',
                cryoFreezeCount: streakData.cryo_freeze_count || 0,
                lastEntryDate: streakData.last_entry_date,
                phoenixActive: streakData.phoenix_active || false,
                phoenixDaysRemaining: streakData.phoenix_days_remaining || 0,
                phoenixStartStreak: streakData.phoenix_start_streak || 0,
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
                dopamineContent: todayEntry.dopamine_content,
                gaming: todayEntry.gaming,
                paradigm: (todayEntry.paradigm ?? 0) >= 1,
                updatedAt: todayEntry.updated_at,
            } : undefined,
        };
    });
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
        .select('user_id')
        .eq('friend_id', userId)
        .eq('status', 'pending');

    if (incomingError) throw incomingError;

    const { data: outgoingData, error: outgoingError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'pending');

    if (outgoingError) throw outgoingError;

    const incomingIds = incomingData.map(r => r.user_id);
    const outgoingIds = outgoingData.map(r => r.friend_id);

    const incomingUsers = await getFriendData(incomingIds);
    const outgoingUsers = await getFriendData(outgoingIds);

    const mapToFriend = (user: any): Friend => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar as AvatarType,
        rank: user.rank as RankType,
        status: 'pending' as const,
        totalXp: user.total_xp || 0,
        streak: {
            currentStreak: user.streaks[0]?.current_streak || 0,
            longestStreak: user.streaks[0]?.longest_streak || 0,
            level: user.streaks[0]?.level || 'frozen',
            cryoFreezeCount: user.streaks[0]?.cryo_freeze_count || 0,
            lastEntryDate: user.streaks[0]?.last_entry_date,
            phoenixActive: user.streaks[0]?.phoenix_active || false,
            phoenixDaysRemaining: user.streaks[0]?.phoenix_days_remaining || 0,
            phoenixStartStreak: user.streaks[0]?.phoenix_start_streak || 0,
        },
        todayScore: null,
        todayCompleted: false,
        monthlyAverage: user.monthly_average || 0,
        lastPingedAt: null,
    });

    return {
        incoming: incomingUsers.map(mapToFriend),
        outgoing: outgoingUsers.map(mapToFriend),
    };
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
    const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'connected');

    if (friendError) throw friendError;

    const friendIds = friendships.map(f => f.friend_id);
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
