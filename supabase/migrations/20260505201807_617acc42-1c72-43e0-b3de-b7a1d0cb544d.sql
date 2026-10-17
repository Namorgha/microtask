
-- Verification status enum
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected','needs_more_info','revoked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_type AS ENUM ('identity','address');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS address_verified_at timestamptz;

-- Requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verification_type public.verification_type NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  document_url text,
  selfie_url text,
  address_document_url text,
  admin_notes text,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verif_user ON public.verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verif_status ON public.verification_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_per_type
  ON public.verification_requests(user_id, verification_type)
  WHERE status IN ('pending','needs_more_info');

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- RLS
DROP POLICY IF EXISTS "Users view own verification requests" ON public.verification_requests;
CREATE POLICY "Users view own verification requests"
  ON public.verification_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Users insert own verification requests" ON public.verification_requests;
CREATE POLICY "Users insert own verification requests"
  ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.banned_at IS NOT NULL)
  );

DROP POLICY IF EXISTS "Admins manage verification requests" ON public.verification_requests;
CREATE POLICY "Admins manage verification requests"
  ON public.verification_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete verification requests" ON public.verification_requests;
CREATE POLICY "Admins delete verification requests"
  ON public.verification_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS verif_set_updated_at ON public.verification_requests;
CREATE TRIGGER verif_set_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync profile flags when verification approved/revoked
CREATE OR REPLACE FUNCTION public.sync_verification_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.verification_type = 'identity' THEN
      UPDATE public.profiles
        SET identity_verified = true, identity_verified_at = now()
        WHERE user_id = NEW.user_id;
    ELSIF NEW.verification_type = 'address' THEN
      UPDATE public.profiles
        SET address_verified = true, address_verified_at = now()
        WHERE user_id = NEW.user_id;
    END IF;
  ELSIF NEW.status = 'revoked' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.verification_type = 'identity' THEN
      UPDATE public.profiles SET identity_verified = false, identity_verified_at = null WHERE user_id = NEW.user_id;
    ELSIF NEW.verification_type = 'address' THEN
      UPDATE public.profiles SET address_verified = false, address_verified_at = null WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verif_sync_flags ON public.verification_requests;
CREATE TRIGGER verif_sync_flags
  AFTER UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_verification_flags();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents','verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owner can upload/read, admin can read/delete
DROP POLICY IF EXISTS "Verif owner upload" ON storage.objects;
CREATE POLICY "Verif owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Verif owner read" ON storage.objects;
CREATE POLICY "Verif owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'))
  );

DROP POLICY IF EXISTS "Verif owner delete" ON storage.objects;
CREATE POLICY "Verif owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'))
  );
