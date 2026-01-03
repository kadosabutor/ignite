import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { HabitEntry, UserProfile, StreakData, Friend } from '../types';
import * as supabase from '../lib/supabase';
import { getTodayString } from '../lib/scoring';
import { v4 as uuidv4 } from 'uuid';

interface HabitContextType {
  // Auth
  isAuthenticated: boolean;
  isLoading: boolean;
  authUser: any | null;
  signUp: (email: string, password: string, username: string, displayName: string, avatar: 'lion' | 'wolf' | 'bull') => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  
  // Entries
  entries: HabitEntry[];
  todayEntry: HabitEntry | null;
  saveEntry: (entry: HabitEntry) => Promise<void>;
  deleteEntry: (date: string) => Promise<void>;
  getEntryByDate: (date: string) => HabitEntry | undefined;
  refreshEntries: () => Promise<void>;
  
  // User
  user: UserProfile | null;
  streak: StreakData;
  saveUser: (user: Partial<UserProfile>) => Promise<void>;
  
  // Friends
  friends: Friend[];
  pendingRequests: { incoming: Friend[]; outgoing: Friend[] };
  addFriend: (username: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  acceptFriendRequest: (requesterId: string) => Promise<void>;
  rejectFriendRequest: (requesterId: string) => Promise<void>;
  cancelFriendRequest: (friendId: string) => Promise<void>;
  refreshFriends: () => Promise<void>;
  refreshPendingRequests: () => Promise<void>;
  
  // Stats
  weeklyAverage: number;
  monthlyAverage: number;
  
  // Leaderboard
  getLeaderboard: (period: 'today' | 'week' | 'month') => Promise<any[]>;
}

const HabitContext = createContext<HabitContextType | null>(null);

export function HabitProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ incoming: Friend[]; outgoing: Friend[] }>({ incoming: [], outgoing: [] });

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await supabase.getCurrentUser();
        if (currentUser) {
          setAuthUser(currentUser);
          setIsAuthenticated(true);
          await loadUserData(currentUser.id);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.onAuthStateChange(async (user) => {
      setAuthUser(user);
      setIsAuthenticated(!!user);
      if (user) {
        await loadUserData(user.id);
      } else {
        setEntries([]);
        setUser(null);
        setFriends([]);
        setPendingRequests({ incoming: [], outgoing: [] });
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const [loadedProfile, loadedEntries, loadedFriends, loadedPendingRequests] = await Promise.all([
        supabase.getUserProfile(userId),
        supabase.getAllEntries(userId),
        supabase.getAllFriends(userId),
        supabase.getPendingFriendRequests(userId),
      ]);
      
      setUser(loadedProfile);
      setEntries(loadedEntries);
      setFriends(loadedFriends);
      setPendingRequests(loadedPendingRequests);
      
      // Subscribe to real-time updates
      supabase.subscribeToEntries(userId, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          refreshEntries();
        } else if (payload.eventType === 'DELETE') {
          refreshEntries();
        }
      });
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  const signUp = useCallback(async (email: string, password: string, username: string, displayName: string, avatar: 'lion' | 'wolf' | 'bull') => {
    await supabase.signUp(email, password, username, displayName, avatar);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await supabase.signIn(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.signOut();
    setAuthUser(null);
    setIsAuthenticated(false);
    setEntries([]);
    setUser(null);
    setFriends([]);
  }, []);

  const refreshEntries = useCallback(async () => {
    if (!authUser) return;
    
    const loadedEntries = await supabase.getAllEntries(authUser.id);
    setEntries(loadedEntries);
    
    // Also refresh user for updated streak
    const loadedProfile = await supabase.getUserProfile(authUser.id);
    setUser(loadedProfile);
  }, [authUser]);

  const saveEntry = useCallback(async (entry: HabitEntry) => {
    if (!authUser) return;
    
    // Ensure entry has an ID
    if (!entry.id) {
      entry.id = uuidv4();
    }
    
    await supabase.saveEntry(authUser.id, entry);
    await refreshEntries();
  }, [authUser, refreshEntries]);

  const deleteEntry = useCallback(async (date: string) => {
    if (!authUser) return;
    
    await supabase.deleteEntry(authUser.id, date);
    await refreshEntries();
  }, [authUser, refreshEntries]);

  const getEntryByDate = useCallback((date: string) => {
    return entries.find(e => e.date === date);
  }, [entries]);

  const saveUser = useCallback(async (updatedUser: Partial<UserProfile>) => {
    if (!authUser || !user) return;
    
    await supabase.saveUserProfile({ ...updatedUser, id: authUser.id });
    const loadedProfile = await supabase.getUserProfile(authUser.id);
    setUser(loadedProfile);
  }, [authUser, user]);

  const addFriend = useCallback(async (username: string) => {
    if (!authUser) return;
    
    await supabase.addFriend(authUser.id, username);
    await refreshFriends();
    await refreshPendingRequests();
  }, [authUser]);

  const removeFriend = useCallback(async (friendId: string) => {
    if (!authUser) return;
    
    await supabase.removeFriend(authUser.id, friendId);
    await refreshFriends();
  }, [authUser]);

  const acceptFriendRequest = useCallback(async (requesterId: string) => {
    if (!authUser) return;
    
    await supabase.acceptFriendRequest(authUser.id, requesterId);
    await refreshFriends();
    await refreshPendingRequests();
  }, [authUser]);

  const rejectFriendRequest = useCallback(async (requesterId: string) => {
    if (!authUser) return;
    
    await supabase.rejectFriendRequest(authUser.id, requesterId);
    await refreshPendingRequests();
  }, [authUser]);

  const cancelFriendRequest = useCallback(async (friendId: string) => {
    if (!authUser) return;
    
    await supabase.cancelFriendRequest(authUser.id, friendId);
    await refreshPendingRequests();
  }, [authUser]);

  const refreshFriends = useCallback(async () => {
    if (!authUser) return;
    
    const loadedFriends = await supabase.getAllFriends(authUser.id);
    setFriends(loadedFriends);
  }, [authUser]);

  const refreshPendingRequests = useCallback(async () => {
    if (!authUser) return;
    
    const loadedPendingRequests = await supabase.getPendingFriendRequests(authUser.id);
    setPendingRequests(loadedPendingRequests);
  }, [authUser]);

  const getLeaderboard = useCallback(async (period: 'today' | 'week' | 'month') => {
    if (!authUser) return [];
    
    return await supabase.getLeaderboard(authUser.id, period);
  }, [authUser]);

  // Computed values
  const todayEntry = entries.find(e => e.date === getTodayString()) || null;
  
  const streak: StreakData = user?.streak || {
    currentStreak: 0,
    longestStreak: 0,
    level: 'frozen',
    cryoFreezeCount: 0,
    lastEntryDate: null,
    phoenixActive: false,
    phoenixDaysRemaining: 0,
    phoenixStartStreak: 0,
  };

  const weeklyAverage = (() => {
    const last7 = entries.slice(0, 7);
    if (last7.length === 0) return 0;
    return last7.reduce((sum, e) => sum + e.score, 0) / last7.length;
  })();

  const monthlyAverage = user?.monthlyAverage || 0;

  return (
    <HabitContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authUser,
        signUp,
        signIn,
        signOut,
        entries,
        todayEntry,
        saveEntry,
        deleteEntry,
        getEntryByDate,
        refreshEntries,
        user,
        streak,
        saveUser,
        friends,
        pendingRequests,
        addFriend,
        removeFriend,
        acceptFriendRequest,
        rejectFriendRequest,
        cancelFriendRequest,
        refreshFriends,
        refreshPendingRequests,
        weeklyAverage,
        monthlyAverage,
        getLeaderboard,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}

export function useHabits() {
  const context = useContext(HabitContext);
  if (!context) {
    throw new Error('useHabits must be used within a HabitProvider');
  }
  return context;
}
