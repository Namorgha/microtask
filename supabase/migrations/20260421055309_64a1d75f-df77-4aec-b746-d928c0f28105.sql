
-- Allow authenticated users to insert notifications for task participants they share a task with
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications for task counterparts"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Self notifications always allowed
  auth.uid() = user_id
  OR
  -- Notifying poster/doer of a task you're involved in (as poster, doer, or applicant)
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = ((data->>'task_id')::uuid)
      AND (
        (t.poster_id = auth.uid() AND (t.doer_id = notifications.user_id OR EXISTS (
          SELECT 1 FROM public.task_applications ta WHERE ta.task_id = t.id AND ta.doer_id = notifications.user_id
        )))
        OR (t.doer_id = auth.uid() AND t.poster_id = notifications.user_id)
        OR (EXISTS (
          SELECT 1 FROM public.task_applications ta WHERE ta.task_id = t.id AND ta.doer_id = auth.uid()
        ) AND t.poster_id = notifications.user_id)
      )
  )
);
