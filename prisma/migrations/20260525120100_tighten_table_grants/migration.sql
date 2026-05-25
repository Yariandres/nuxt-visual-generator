-- BL-008 follow-up: tighten Supabase's default-broad table grants.
--
-- Supabase grants ALL privileges on every `public.*` table to `anon`,
-- `authenticated`, and `service_role` by default. RLS already denies the
-- unintended verbs, but the over-broad grants are a foot-gun: any future
-- policy missing a `TO authenticated` scope or a stricter USING clause
-- would have nothing standing in its way. This migration removes verbs
-- that should never reach those roles, so grants and RLS form two
-- independent layers of denial.
--
-- `service_role` is intentionally left untouched -- it is the role the
-- backend uses for Supabase JS calls with NUXT_SUPABASE_SECRET_KEY.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN

    -- anon: no direct access to any application table. Auth flows still
    -- work because they go through auth.* schemas, not public.*.
    EXECUTE 'REVOKE ALL ON TABLE public.profiles     FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.presets      FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.projects     FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.generations  FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.usage_events FROM anon';

    -- authenticated: trim write verbs on tables where the policy set is
    -- SELECT-only. Reads remain allowed (and RLS-filtered).
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.generations  FROM authenticated';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.usage_events FROM authenticated';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.presets      FROM authenticated';

    -- authenticated on profiles: only UPDATE is allowed (the
    -- handle_new_user trigger does the INSERT via SECURITY DEFINER,
    -- and DELETE flows from the auth.users cascade).
    EXECUTE 'REVOKE INSERT, DELETE, TRUNCATE ON TABLE public.profiles FROM authenticated';

    -- authenticated on projects: full CRUD allowed, just strip TRUNCATE.
    EXECUTE 'REVOKE TRUNCATE ON TABLE public.projects FROM authenticated';

  END IF;
END$$;
