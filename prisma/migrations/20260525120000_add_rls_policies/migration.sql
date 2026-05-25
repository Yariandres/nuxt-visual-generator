-- BL-008: Row Level Security policies for the V1 single-user data model.
--
-- These policies act as defense-in-depth for queries authenticated through
-- Supabase Auth (the anon key + user JWT path used by useSupabaseClient()).
-- Prisma connects as the `postgres` superuser and bypasses RLS entirely;
-- `service_role` bypasses RLS as well. Backend-layer authorization (BL-033)
-- remains the primary access boundary for server routes.

-- =====================================================================
-- 1. Enable RLS on every user-touched table.
-- Unconditional so the bit is set even on Prisma's shadow database; the
-- statement does not reference the `auth` schema, so it is portable.
-- =====================================================================

ALTER TABLE "profiles"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presets"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. Grants + policies. Wrapped in a guard so the migration still applies
-- on non-Supabase Postgres (where auth.users and the `authenticated` role
-- do not exist). On such databases RLS stays on but no grants/policies
-- exist, so only superusers can read these tables -- fail-closed for any
-- dev environment that doesn't shim Supabase Auth.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN

    -- Grants: Prisma-created tables are owned by `postgres` and do NOT
    -- receive Supabase's default grants to `authenticated`. Without these
    -- the authenticated role hits "permission denied" before RLS even
    -- evaluates. Grant the minimal verbs we want each table to expose.
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects     TO authenticated';
    EXECUTE 'GRANT SELECT                         ON TABLE public.generations  TO authenticated';
    EXECUTE 'GRANT SELECT                         ON TABLE public.usage_events TO authenticated';
    EXECUTE 'GRANT SELECT, UPDATE                 ON TABLE public.profiles     TO authenticated';
    EXECUTE 'GRANT SELECT                         ON TABLE public.presets      TO authenticated';

    -- ----- profiles ---------------------------------------------------
    -- User can read & update their own row.
    -- INSERT is owned by the handle_new_user trigger (init migration).
    -- DELETE flows from the auth.users cascade; no user-facing policy.

    EXECUTE 'DROP POLICY IF EXISTS profiles_select_own ON public.profiles';
    EXECUTE 'CREATE POLICY profiles_select_own ON public.profiles
             FOR SELECT TO authenticated
             USING (id = auth.uid())';

    EXECUTE 'DROP POLICY IF EXISTS profiles_update_own ON public.profiles';
    EXECUTE 'CREATE POLICY profiles_update_own ON public.profiles
             FOR UPDATE TO authenticated
             USING      (id = auth.uid())
             WITH CHECK (id = auth.uid())';

    -- ----- presets ----------------------------------------------------
    -- Authenticated users can read active presets only. All writes are
    -- backend-only (service_role bypasses RLS).

    EXECUTE 'DROP POLICY IF EXISTS presets_select_active ON public.presets';
    EXECUTE 'CREATE POLICY presets_select_active ON public.presets
             FOR SELECT TO authenticated
             USING (is_active = true)';

    -- ----- projects ---------------------------------------------------
    -- Full CRUD on own rows. UPDATE pins user_id via USING + WITH CHECK
    -- so a row cannot be re-assigned to another user.

    EXECUTE 'DROP POLICY IF EXISTS projects_select_own ON public.projects';
    EXECUTE 'CREATE POLICY projects_select_own ON public.projects
             FOR SELECT TO authenticated
             USING (user_id = auth.uid())';

    EXECUTE 'DROP POLICY IF EXISTS projects_insert_own ON public.projects';
    EXECUTE 'CREATE POLICY projects_insert_own ON public.projects
             FOR INSERT TO authenticated
             WITH CHECK (user_id = auth.uid())';

    EXECUTE 'DROP POLICY IF EXISTS projects_update_own ON public.projects';
    EXECUTE 'CREATE POLICY projects_update_own ON public.projects
             FOR UPDATE TO authenticated
             USING      (user_id = auth.uid())
             WITH CHECK (user_id = auth.uid())';

    EXECUTE 'DROP POLICY IF EXISTS projects_delete_own ON public.projects';
    EXECUTE 'CREATE POLICY projects_delete_own ON public.projects
             FOR DELETE TO authenticated
             USING (user_id = auth.uid())';

    -- ----- generations ------------------------------------------------
    -- SELECT only on own rows. INSERT/UPDATE/DELETE are backend-only
    -- (service_role bypasses RLS). Grants also exclude write verbs.

    EXECUTE 'DROP POLICY IF EXISTS generations_select_own ON public.generations';
    EXECUTE 'CREATE POLICY generations_select_own ON public.generations
             FOR SELECT TO authenticated
             USING (user_id = auth.uid())';

    -- ----- usage_events -----------------------------------------------
    -- SELECT only on own rows. Writes are backend-only.

    EXECUTE 'DROP POLICY IF EXISTS usage_events_select_own ON public.usage_events';
    EXECUTE 'CREATE POLICY usage_events_select_own ON public.usage_events
             FOR SELECT TO authenticated
             USING (user_id = auth.uid())';

  END IF;
END$$;
