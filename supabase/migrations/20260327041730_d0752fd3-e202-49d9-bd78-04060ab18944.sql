
-- Add foreign key from tasks.poster_id to profiles.user_id
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_poster_id_profiles_fkey
  FOREIGN KEY (poster_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from tasks.doer_id to profiles.user_id
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_doer_id_profiles_fkey
  FOREIGN KEY (doer_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Create app_settings table for admin-configurable settings
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Settings are readable by everyone"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default setting for email verification
INSERT INTO public.app_settings (key, value)
VALUES ('require_email_verification', '"true"'::jsonb);
