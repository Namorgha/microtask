
-- Add flagged column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS flag_reason text DEFAULT NULL;

-- Add more platform settings
INSERT INTO public.app_settings (key, value) VALUES
  ('platform_fee_percent', '8'::jsonb),
  ('min_task_price', '5'::jsonb),
  ('max_task_price', '10000'::jsonb),
  ('default_radius_km', '25'::jsonb),
  ('enable_new_signups', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Allow admins to read all user roles (needed for admin user management)
CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage user roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
