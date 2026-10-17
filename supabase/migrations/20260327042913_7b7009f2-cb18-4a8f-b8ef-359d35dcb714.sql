
-- Add banned_at to profiles for ban/unban
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create activity_logs table for admin actions
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert logs
CREATE POLICY "Admins can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update the email verification setting to false (disabled)
UPDATE public.app_settings SET value = '"false"'::jsonb WHERE key = 'require_email_verification';
