-- IGNITE – biztonsági javítások (2026-10-13)
--  1. RLS bekapcsolása minden public táblán (eddig 8 táblán ki volt kapcsolva)
--  2. Hiányzó policy-k: friendships UPDATE (elfogadás), notifications
--  3. users.email elrejtése a kliensek elől (oszlopszintű jogosultság)
--  4. Profil/streak/settings létrehozása triggerrel regisztrációkor
--     (email-megerősítésnél nincs session, ezért a kliens RLS mellett nem tud beszúrni)
--  5. Óránkénti cron: Vaultban tárolt titok, nincs beégetett service role kulcs

-- ---------------------------------------------------------------------------
-- 1–2. RLS és policy-k
-- ---------------------------------------------------------------------------

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
-- Nem használt táblák: policy nélkül csak a service role éri el őket
ALTER TABLE public.friend_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_interactions ENABLE ROW LEVEL SECURITY;

-- Profilokat csak bejelentkezett felhasználó láthat (barátkereséshez kell)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT TO authenticated USING (true);

-- Barátkérelem elfogadása: a címzett 'connected'-re állíthatja
DROP POLICY IF EXISTS "Users can accept received friendships" ON public.friendships;
CREATE POLICY "Users can accept received friendships" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = friend_id)
  WITH CHECK (auth.uid() = friend_id AND status = 'connected');

-- Értesítések: csak a sajátjait olvashatja / jelölheti olvasottnak.
-- Beszúrás csak a send-push Edge Functionből (service role).
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Avatar feltöltés csak a saját mappába (<user_id>/...)
DROP POLICY IF EXISTS "Saját avatar feltöltése" ON storage.objects;
CREATE POLICY "Saját avatar feltöltése" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 3. users.email elrejtése
-- ---------------------------------------------------------------------------

REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT (
  id, username, display_name, avatar, bio, rank, monthly_average,
  created_at, updated_at, yesterday_score, previous_rank, total_xp
) ON public.users TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Regisztrációs trigger
-- ---------------------------------------------------------------------------

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Regisztráció előtti felhasználónév-ellenőrzés (kijelentkezve nincs SELECT jog a users táblán)
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

-- Hiányzó settings / streaks sorok pótlása a meglévő felhasználóknak
INSERT INTO public.settings (user_id)
SELECT u.id FROM public.users u
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.streaks (user_id)
SELECT u.id FROM public.users u
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Óránkénti értesítés-ütemező
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ignite_cron_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'ignite_cron_secret',
      'cron-scheduler Edge Function hitelesítése'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- $1: a `secret` név ütközne a vault.decrypted_secrets.secret oszloppal
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets ds
    WHERE ds.name = 'ignite_cron_secret' AND ds.decrypted_secret = $1
  );
$$;

REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

-- A régi job beégetett kulccsal hívta a (nem telepített) függvényt
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ignite-hourly-push') THEN
    PERFORM cron.unschedule('ignite-hourly-push');
  END IF;
END;
$$;

SELECT cron.schedule(
  'ignite-hourly-push',
  '0 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://thibewmulezvjenwowmh.supabase.co/functions/v1/cron-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ignite_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
