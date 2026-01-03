-- IGNITE PWA - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar TEXT DEFAULT 'lion' CHECK (avatar IN ('lion', 'wolf', 'bull')),
  bio TEXT,
  rank TEXT DEFAULT 'sleepwalker' CHECK (rank IN ('sleepwalker', 'grinder', 'operator', 'highperformer', 'monkmode', 'titan')),
  monthly_average FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit entries table
CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  wake_up_time TEXT,
  bed_time TEXT,
  business_minutes INT DEFAULT 0,
  sleep_minutes INT DEFAULT 0,
  clean_eating BOOLEAN DEFAULT FALSE,
  exercise BOOLEAN DEFAULT FALSE,
  paradigm INT DEFAULT 0,
  satisfaction BOOLEAN DEFAULT FALSE,
  dopamine_content BOOLEAN DEFAULT FALSE,
  gaming BOOLEAN DEFAULT FALSE,
  score INT DEFAULT 0,
  reflection_goal TEXT,
  reflection_obstacle TEXT,
  reflection_personal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Streak data table
CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  level TEXT DEFAULT 'frozen' CHECK (level IN ('spark', 'blaze', 'inferno', 'plasma', 'frozen', 'phoenix')),
  cryo_freeze_count INT DEFAULT 0,
  last_entry_date DATE,
  phoenix_active BOOLEAN DEFAULT FALSE,
  phoenix_days_remaining INT DEFAULT 0,
  phoenix_start_streak INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  notifications JSONB DEFAULT '{"enabled": true, "morningEnabled": true, "afternoonEnabled": true, "eveningEnabled": true, "streakEnabled": true, "socialEnabled": true, "morningTime": "07:00", "afternoonTime": "15:00", "eveningTime": "21:00"}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON public.entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.entries(date);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Entries policies
CREATE POLICY "Users can view own entries" ON public.entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends entries" ON public.entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.user_id = auth.uid()
      AND friendships.friend_id = entries.user_id
      AND friendships.status = 'connected'
    )
  );

CREATE POLICY "Users can insert own entries" ON public.entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries" ON public.entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries" ON public.entries
  FOR DELETE USING (auth.uid() = user_id);

-- Streaks policies
CREATE POLICY "Users can view own streak" ON public.streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends streaks" ON public.streaks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.user_id = auth.uid()
      AND friendships.friend_id = streaks.user_id
      AND friendships.status = 'connected'
    )
  );

CREATE POLICY "Users can manage own streak" ON public.streaks
  FOR ALL USING (auth.uid() = user_id);

-- Friendships policies
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they received" ON public.friendships
  FOR UPDATE USING (auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Settings policies
CREATE POLICY "Users can manage own settings" ON public.settings
  FOR ALL USING (auth.uid() = user_id);

-- Enable realtime for entries (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streaks;
