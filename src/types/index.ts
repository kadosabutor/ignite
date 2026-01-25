// Habit Entry types
export interface HabitEntry {
  id: string;
  date: string; // YYYY-MM-DD
  wakeUpTime: string | null; // HH:MM
  bedTime: string | null; // HH:MM
  businessMinutes: number;
  sleepMinutes: number;
  cleanEating: boolean;
  exercise: boolean;
  paradigm: boolean;
  satisfaction: boolean;
  dopamineContent: boolean;
  gaming: boolean;
  sleepHRV?: number;
  restingPulse?: number;
  sleepEfficiency?: number;
  approachedGoal?: string;
  businessObstacle?: string;
  personalObstacle?: string;
  score: number;
  createdAt: string;
  updatedAt: string;
}

// Streak types
export type StreakLevel = 'spark' | 'blaze' | 'inferno' | 'plasma' | 'frozen' | 'phoenix';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  level: StreakLevel;
  cryoFreezeCount: number;
  lastEntryDate: string | null;
  phoenixActive: boolean;
  phoenixDaysRemaining: number;
  phoenixStartStreak: number;
}

// User types
export type AvatarType = string;
export type RankType = 'sleepwalker' | 'grinder' | 'operator' | 'highperformer' | 'monkmode' | 'titan';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: AvatarType;
  bio: string;
  rank: RankType;
  monthlyAverage: number;
  streak: StreakData;
  createdAt: string;
  // ÚJ: XP Rendszer
  totalXp: number;
}

// ÚJ: Badge típusok
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'focus' | 'vitality' | 'will' | 'mind' | 'special';
  requirement: string;
  unlockedAt?: string; // Ha undefined, akkor zárolt
}

// Friend types
export type FriendStatus = 'pending' | 'connected';

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar: AvatarType;
  rank: RankType;
  status: FriendStatus;
  streak: StreakData;
  todayScore: number | null;
  todayCompleted: boolean;
  monthlyAverage: number;
  lastPingedAt: string | null;
  bio?: string;
  // ÚJ: XP a barátoknál is megjelenhet (opcionális)
  totalXp?: number;
  todayEntry?: {
    score: number;
    businessMinutes: number;
    sleepMinutes: number;
    exercise: boolean;
    cleanEating: boolean;
    satisfaction: boolean;
    dopamineContent: boolean;
    gaming: boolean;
    paradigm: boolean;
    updatedAt: string;
  };
}

// VS Mode types
export interface VSComparison {
  user: UserProfile;
  friend: Friend;
  userStats: RadarStats;
  friendStats: RadarStats;
  weeklyScores: {
    user: number[];
    friend: number[];
    dates: string[];
  };
}

export interface RadarStats {
  business: number; // 0-100
  discipline: number; // 0-100
  body: number; // 0-100
  mind: number; // 0-100
  sleep: number; // 0-100
}

// Leaderboard types
export type LeaderboardPeriod = 'today' | 'week' | 'month';

export interface LeaderboardEntry {
  position: number;
  user: Friend | UserProfile;
  score: number;
  trend: 'up' | 'down' | 'same';
  isCurrentUser: boolean;
}

// Notification & UI Settings types
export interface NotificationSettings {
  enabled: boolean;
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  eveningEnabled: boolean;
  streakEnabled: boolean;
  socialEnabled: boolean;
  morningTime: string;
  afternoonTime: string;
  eveningTime: string;
  // ÚJ: UI beállítás
  inputMode?: 'dashboard' | 'wizard';
}

// Rank definitions
export const RANKS: Record<RankType, { name: string; emoji: string; minScore: number; maxScore: number; color: string }> = {
  sleepwalker: { name: 'Sleepwalker', emoji: '😴', minScore: 0, maxScore: 49.9, color: '#6B7280' },
  grinder: { name: 'Grinder', emoji: '🔨', minScore: 50, maxScore: 69.9, color: '#9CA3AF' },
  operator: { name: 'Operator', emoji: '⚙️', minScore: 70, maxScore: 79.9, color: '#F59E0B' },
  highperformer: { name: 'High Performer', emoji: '🚀', minScore: 80, maxScore: 89.9, color: '#EF4444' },
  monkmode: { name: 'Monk Mode Master', emoji: '🧘‍♂️', minScore: 90, maxScore: 98.9, color: '#8B5CF6' },
  titan: { name: 'TITAN', emoji: '⚡', minScore: 99, maxScore: 100, color: '#FFD700' },
};

// Streak level definitions
export const STREAK_LEVELS: Record<StreakLevel, { name: string; minDays: number; maxDays: number; color: string; icon: string }> = {
  spark: { name: 'Spark', minDays: 1, maxDays: 7, color: '#FFCC00', icon: '/assets/streaks/Spark(Streaklv1).svg' },
  blaze: { name: 'Blaze', minDays: 8, maxDays: 30, color: '#FF7033', icon: '/assets/streaks/Blaze(Streaklv2).svg' },
  inferno: { name: 'Inferno', minDays: 31, maxDays: 90, color: '#33CCFF', icon: '/assets/streaks/Inferno(Streaklv3).svg' },
  plasma: { name: 'Plasma', minDays: 91, maxDays: Infinity, color: '#B833FF', icon: '/assets/streaks/plasma(Streaklv4).svg' },
  frozen: { name: 'Frozen', minDays: 0, maxDays: 0, color: '#87CEEB', icon: '/assets/streaks/frozen(StreakLost).svg' },
  phoenix: { name: 'Phoenix', minDays: 0, maxDays: 0, color: '#FF6B6B', icon: '/assets/streaks/phoenix(StreakTrial).svg' },
};

// Avatar definitions
export const AVATARS: Record<string, { name: string; icon: string }> = {
  lion: { name: 'Oroszlán', icon: '/assets/avatars/LionAvatar.svg' },
  wolf: { name: 'Farkas', icon: '/assets/avatars/wolfavatar.svg' },
  bull: { name: 'Bika', icon: '/assets/avatars/bullavatar.svg' },
};

export const getAvatarSrc = (avatar: string) => {
  if (avatar && avatar in AVATARS) {
    return AVATARS[avatar].icon;
  }
  return avatar || AVATARS.lion.icon;
};
