
-- Update payments status check to canonical values used by the app
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'escrow'::text, 'released'::text, 'refunded'::text]));

-- Helper RPC: recompute completed_tasks_count from tasks (source of truth)
CREATE OR REPLACE FUNCTION public.increment_completed_tasks(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET completed_tasks_count = (
    SELECT COUNT(*) FROM public.tasks
    WHERE doer_id = _user_id AND status IN ('completed','paid')
  )
  WHERE user_id = _user_id;
END;
$$;

-- Trigger: keep completed counts in sync as task statuses change
CREATE OR REPLACE FUNCTION public.sync_task_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.doer_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.increment_completed_tasks(NEW.doer_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.doer_id IS NOT NULL AND OLD.doer_id IS DISTINCT FROM NEW.doer_id THEN
    PERFORM public.increment_completed_tasks(OLD.doer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_status_sync ON public.tasks;
CREATE TRIGGER on_task_status_sync
AFTER INSERT OR UPDATE OF status, doer_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_counts();

-- Allow participants to update payment status (needed for escrow lifecycle)
DROP POLICY IF EXISTS "Participants can update payments" ON public.payments;
CREATE POLICY "Participants can update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() = payer_id OR auth.uid() = payee_id)
WITH CHECK (auth.uid() = payer_id OR auth.uid() = payee_id);

-- Backfill profile counts
UPDATE public.profiles p
SET completed_tasks_count = (
  SELECT COUNT(*) FROM public.tasks t
  WHERE t.doer_id = p.user_id AND t.status IN ('completed','paid')
);

-- Backfill payments stuck in pending/escrow when their task is already paid
UPDATE public.payments pm
SET status = 'released', updated_at = now()
FROM public.tasks t
WHERE pm.task_id = t.id
  AND t.status = 'paid'
  AND pm.status IN ('pending','escrow');
