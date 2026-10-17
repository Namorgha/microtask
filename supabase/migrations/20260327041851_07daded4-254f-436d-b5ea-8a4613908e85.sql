
-- Allow admins to delete any task
CREATE POLICY "Admins can delete any task"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any task
CREATE POLICY "Admins can update any task"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
