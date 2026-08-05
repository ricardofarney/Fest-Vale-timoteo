
-- Fix handle_new_user search_path already set, touch_updated_at needs fix
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Revoke EXECUTE on SECURITY DEFINER funcs from anon/authenticated (still usable by RLS policies via definer context)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Restrict public listing of bucket: only allow SELECT on objects users own or via known path is fine for covers (public-read by URL still works since bucket is public),
-- but storage policy controls listing via the API. Replace the broad policy with one that allows reading metadata only for organizers' own files; public images remain accessible via direct CDN URL.
DROP POLICY IF EXISTS "public read event covers" ON storage.objects;
CREATE POLICY "owners list own event covers" ON storage.objects FOR SELECT USING (
  bucket_id = 'event-covers' AND auth.uid() = owner
);
