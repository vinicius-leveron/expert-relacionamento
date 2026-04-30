-- Add profile fields for app profile editing
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS avatar_storage_path TEXT;

COMMENT ON COLUMN public.users.display_name IS 'Optional user-facing display name configured from the app';
COMMENT ON COLUMN public.users.avatar_storage_path IS 'Storage path for the user avatar image';
