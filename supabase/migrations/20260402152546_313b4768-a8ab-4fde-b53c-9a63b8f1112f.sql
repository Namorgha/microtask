
-- Add 'funded' to task_status enum
ALTER TYPE task_status ADD VALUE 'funded' AFTER 'accepted';

-- Create task_messages table
CREATE TABLE public.task_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;

-- RLS: SELECT - poster or doer can view
CREATE POLICY "Poster or doer can view messages"
  ON public.task_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_messages.task_id
        AND (tasks.poster_id = auth.uid() OR tasks.doer_id = auth.uid())
    )
  );

-- RLS: INSERT - poster or doer can send, sender_id must match, not banned
CREATE POLICY "Poster or doer can send messages"
  ON public.task_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_messages.task_id
        AND (tasks.poster_id = auth.uid() OR tasks.doer_id = auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.banned_at IS NOT NULL
    )
  );

-- Unique constraint on task_applications to prevent duplicate requests
ALTER TABLE public.task_applications ADD CONSTRAINT unique_task_doer UNIQUE (task_id, doer_id);

-- Enable realtime for task_messages and task_applications
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_applications;
