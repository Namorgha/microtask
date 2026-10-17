
-- 1. Unique review per (task, reviewer)
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_task_reviewer_unique UNIQUE (task_id, reviewer_id);

-- 2. Tighten review insert RLS (poster/doer of completed|paid task, reviewing the counterpart)
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;

CREATE POLICY "Participants can review counterpart on finished tasks"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND reviewer_id <> reviewee_id
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = reviews.task_id
      AND t.status IN ('completed','paid')
      AND (
        (t.poster_id = auth.uid() AND t.doer_id = reviews.reviewee_id)
        OR
        (t.doer_id = auth.uid() AND t.poster_id = reviews.reviewee_id)
      )
  )
);

-- 3. Trigger to update reputation on review insert
DROP TRIGGER IF EXISTS trg_update_reputation ON public.reviews;
CREATE TRIGGER trg_update_reputation
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_reputation();

-- 4. Trigger to keep completed_tasks_count in sync
DROP TRIGGER IF EXISTS trg_sync_task_counts ON public.tasks;
CREATE TRIGGER trg_sync_task_counts
AFTER INSERT OR UPDATE OF status, doer_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_counts();
