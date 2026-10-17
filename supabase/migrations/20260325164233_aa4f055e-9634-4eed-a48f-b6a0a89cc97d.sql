
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- User roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  skills TEXT[] DEFAULT '{}',
  reputation_score NUMERIC(3,2) DEFAULT 0,
  completed_tasks_count INTEGER DEFAULT 0,
  total_reviews_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Task status enum
CREATE TYPE public.task_status AS ENUM ('open', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled');

-- Task category enum
CREATE TYPE public.task_category AS ENUM ('delivery', 'cleaning', 'repair', 'shopping', 'tech', 'tutoring', 'moving', 'other');

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category task_category NOT NULL DEFAULT 'other',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 5),
  duration INTEGER NOT NULL CHECK (duration >= 10 AND duration <= 60),
  location TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status task_status NOT NULL DEFAULT 'open',
  images TEXT[] DEFAULT '{}',
  doer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks are viewable by everyone" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "Poster or doer can update tasks" ON public.tasks FOR UPDATE USING (auth.uid() = poster_id OR auth.uid() = doer_id);
CREATE POLICY "Poster can delete open tasks" ON public.tasks FOR DELETE USING (auth.uid() = poster_id AND status = 'open');

CREATE INDEX idx_tasks_status ON public.tasks (status);
CREATE INDEX idx_tasks_category ON public.tasks (category);
CREATE INDEX idx_tasks_poster ON public.tasks (poster_id);
CREATE INDEX idx_tasks_location ON public.tasks (lat, lng);

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Task applications
CREATE TABLE public.task_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  doer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, doer_id)
);
ALTER TABLE public.task_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task poster and doer can view applications" ON public.task_applications
  FOR SELECT USING (
    auth.uid() = doer_id OR 
    auth.uid() = (SELECT poster_id FROM public.tasks WHERE id = task_id)
  );
CREATE POLICY "Authenticated users can apply" ON public.task_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = doer_id);
CREATE POLICY "Task poster can update applications" ON public.task_applications
  FOR UPDATE USING (auth.uid() = (SELECT poster_id FROM public.tasks WHERE id = task_id));

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id),
  payer_id UUID NOT NULL REFERENCES auth.users(id),
  payee_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);
CREATE POLICY "System can insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = payer_id);

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, reviewer_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reviews" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- Function to update reputation after review
CREATE OR REPLACE FUNCTION public.update_reputation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET
    reputation_score = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE reviewee_id = NEW.reviewee_id),
    total_reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = NEW.reviewee_id)
  WHERE user_id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_review_created AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_reputation();

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, read, created_at DESC);

-- Storage bucket for task images
INSERT INTO storage.buckets (id, name, public) VALUES ('task-images', 'task-images', true);

CREATE POLICY "Task images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-images');
CREATE POLICY "Authenticated users can upload task images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-images');
CREATE POLICY "Users can delete their own task images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for tasks and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
