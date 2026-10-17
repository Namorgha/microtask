
-- Update tasks INSERT policy to block banned users
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
CREATE POLICY "Authenticated users can create tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = poster_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND banned_at IS NOT NULL)
);

-- Update task_applications INSERT policy to block banned users
DROP POLICY IF EXISTS "Authenticated users can apply" ON public.task_applications;
CREATE POLICY "Authenticated users can apply" ON public.task_applications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = doer_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND banned_at IS NOT NULL)
);
