-- BL-009: Generated-assets storage bucket and read RLS policy.
--
-- Pure infrastructure migration -- creates the private bucket the
-- generation pipeline writes to (BL-026 owns the adapter + signed URLs)
-- and adds a SELECT policy on storage.objects so an authenticated user
-- can only see files under their own `user/<auth.uid()>/...` prefix.
--
-- Service-role writes (backend, NUXT_SUPABASE_SECRET_KEY) bypass Storage
-- RLS, as does Prisma's superuser connection. The primary client read
-- path is signed URLs, which also bypass RLS; this policy is defense-in-
-- depth for any direct storage.objects query routed through an end-user
-- JWT.
--
-- Tested against Supabase Storage as of 2026-05. `allowed_mime_types` and
-- `file_size_limit` on `storage.buckets` are version-sensitive columns.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN

    -- ----- Bucket ------------------------------------------------------
    -- Private bucket. 25 MiB cap and image-only MIME allowlist.
    -- ON CONFLICT DO UPDATE keeps the migration idempotent AND re-asserts
    -- intended settings if someone toggles them in the dashboard.
    EXECUTE $sql$
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'generated-assets',
        'generated-assets',
        false,
        26214400,
        ARRAY['image/png','image/jpeg','image/webp']
      )
      ON CONFLICT (id) DO UPDATE SET
        name               = EXCLUDED.name,
        public             = EXCLUDED.public,
        file_size_limit    = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types
    $sql$;

    -- ----- Storage RLS policy -----------------------------------------
    -- RLS is already enabled on storage.objects by Supabase platform
    -- setup; we only add this policy. Object paths follow
    --   user/<userId>/project/<projectId>/generation/<id>.<ext>
    -- so foldername(name)[1] = 'user' and [2] = <userId>. Compare [2]
    -- against auth.uid()::text -- using [1] would match for all users.
    EXECUTE 'DROP POLICY IF EXISTS generated_assets_select_own ON storage.objects';
    EXECUTE $sql$
      CREATE POLICY generated_assets_select_own ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'generated-assets'
          AND (storage.foldername(name))[1] = 'user'
          AND (storage.foldername(name))[2] = auth.uid()::text
        )
    $sql$;

  END IF;
END$$;
