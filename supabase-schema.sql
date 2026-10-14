-- IGNITE PWA - Supabase adatbázis séma (teljes, friss telepítéshez)
--
-- Az éles adatbázis állapotát tükrözi a 2026-10-13-i biztonsági migráció után
-- (supabase/migrations/20261013120000_security_hardening.sql).
-- Új projektnél: futtasd ezt a Supabase SQL Editorban, majd a migrációs fájl
-- 5. szakaszát (cron + vault) a saját projekt URL-jével.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- Táblák
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar TEXT DEFAULT 'lion',            -- 'lion' | 'wolf' | 'bull' vagy feltöltött kép URL-je
  bio TEXT,
  rank TEXT DEFAULT 'sleepwalker' CHECK (rank IN ('sleepwalker', 'grinder', 'operator', 'highperformer', 'monkmode', 'titan')),
  monthly_average FLOAT DEFAULT 0,
  yesterday_score FLOAT DEFAULT 0,
  previous_rank TEXT DEFAULT 'sleepwalker',
  total_xp INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,                    -- budapesti naptári nap, 04:00-s határral
  wake_up_time TEXT,
  bed_time TEXT,
  business_minutes INT DEFAULT 0,
  sleep_minutes INT DEFAULT 0,
  clean_eating BOOLEAN DEFAULT FALSE,
  exercise BOOLEAN DEFAULT FALSE,
  paradigm INT DEFAULT 0,                -- 0/1 (a kliens boolean-ként kezeli)
  satisfaction BOOLEAN DEFAULT FALSE,
  dopamine_content BOOLEAN DEFAULT FALSE,
  gaming BOOLEAN DEFAULT FALSE,
  score FLOAT DEFAULT 0,
  reflection_goal TEXT,
  reflection_obstacle TEXT,
  reflection_personal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
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

-- Barátság: kérelemnél egy 'pending' sor (user_id = küldő), elfogadáskor
-- a kérelem 'connected' lesz, és létrejön a fordított irányú 'connected' sor is.
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  notifications JSONB DEFAULT '{"enabled": true, "morningEnabled": true, "afternoonEnabled": true, "eveningEnabled": true, "streakEnabled": true, "socialEnabled": true, "morningTime": "07:00", "afternoonTime": "15:00", "eveningTime": "21:00"}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

-- Natív iOS push (APNs) device tokenek
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios')),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jelenleg a kliens nem használja (a ping/tűz csak push értesítés)
CREATE TABLE IF NOT EXISTS public.pings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fires (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS public.daily_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('ping', 'fire')),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, target_user_id, interaction_type, date)
);

-- ============================================================================
-- Indexek
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_entries_user_date ON public.entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.entries(date);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id, status);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fires              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_interactions ENABLE ROW LEVEL SECURITY;

-- users: az email oszlop a kliensek elől rejtett
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT (
  id, username, display_name, avatar, bio, rank, monthly_average,
  created_at, updated_at, yesterday_score, previous_rank, total_xp
) ON public.users TO authenticated;

CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- entries
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

-- streaks
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

-- friendships
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can accept received friendships" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = friend_id)
  WITH CHECK (auth.uid() = friend_id AND status = 'connected');
CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- settings
CREATE POLICY "Users can manage own settings" ON public.settings
  FOR ALL USING (auth.uid() = user_id);

-- push_subscriptions
CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- device_tokens
CREATE POLICY "Users can manage own device tokens" ON public.device_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notifications (beszúrás csak a send-push Edge Functionből, service role-lal)
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_badges
CREATE POLICY "Users can view own badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view friends badges" ON public.user_badges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.user_id = auth.uid()
        AND friendships.friend_id = user_badges.user_id
        AND friendships.status = 'connected'
    )
  );
CREATE POLICY "Users can insert own badges" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- pings / fires
CREATE POLICY "Users can send pings" ON public.pings
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can view received pings" ON public.pings
  FOR SELECT USING (auth.uid() = receiver_id);
CREATE POLICY "Users can send fires" ON public.fires
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can view received fires" ON public.fires
  FOR SELECT USING (auth.uid() = receiver_id);

-- friend_requests, daily_interactions: nincs policy → csak service role

-- ============================================================================
-- Függvények és triggerek
-- ============================================================================

-- Regisztrációkor profil + streak + settings (a metaadatokat a kliens a signUp-nál adja át)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  uname text := NULLIF(trim(meta->>'username'), '');
BEGIN
  IF uname IS NULL THEN
    uname := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  INSERT INTO public.users (id, email, username, display_name, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    uname,
    COALESCE(NULLIF(meta->>'display_name', ''), uname),
    COALESCE(NULLIF(meta->>'avatar', ''), 'lion')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.streaks (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.users WHERE lower(username) = lower(p_username));
$$;

REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- ============================================================================
-- Realtime és Storage
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streaks;

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatarok nyilvános megtekintése" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Saját avatar feltöltése" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Saját avatar frissítése" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Saját avatar törlése" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
