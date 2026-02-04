-- ============================================
-- Saltarelli Web Studio - Multi-tenant SaaS
-- ============================================

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'member');
CREATE TYPE public.pod_member_role AS ENUM ('owner', 'member');
CREATE TYPE public.call_status AS ENUM ('completed', 'missed', 'failed', 'voicemail');
CREATE TYPE public.call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.automation_module_type AS ENUM ('leads', 'sms', 'bookings', 'workflow', 'custom');
CREATE TYPE public.automation_event_status AS ENUM ('success', 'failed', 'pending');
CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'unpaid');
CREATE TYPE public.invoice_status AS ENUM ('paid', 'open', 'failed', 'void');
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');

-- ============================================
-- User Roles Table (separate from profiles)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ============================================
-- Profiles Table
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Pods Table (Client Workspaces)
-- ============================================
CREATE TABLE public.pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  retell_api_key TEXT,
  retell_agent_id TEXT,
  branding_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Pod Members Table
-- ============================================
CREATE TABLE public.pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role pod_member_role NOT NULL DEFAULT 'member',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (pod_id, user_id)
);

-- ============================================
-- Pod Settings Table
-- ============================================
CREATE TABLE public.pod_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL UNIQUE,
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  automations_enabled BOOLEAN NOT NULL DEFAULT false,
  billing_enabled BOOLEAN NOT NULL DEFAULT false,
  visible_modules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Call Logs Table
-- ============================================
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  retell_call_id TEXT UNIQUE,
  caller_number TEXT,
  called_number TEXT,
  direction call_direction,
  duration_seconds INTEGER DEFAULT 0,
  call_status call_status,
  transcript TEXT,
  recording_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  call_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Automation Modules Table
-- ============================================
CREATE TABLE public.automation_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  module_type automation_module_type NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pod_id, module_type)
);

-- ============================================
-- Automation Logs Table
-- ============================================
CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  module_type automation_module_type NOT NULL,
  event_type TEXT NOT NULL,
  event_label TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  status automation_event_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Subscriptions Table
-- ============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status subscription_status NOT NULL DEFAULT 'active',
  plan_name TEXT,
  amount NUMERIC(10, 2),
  billing_cycle billing_cycle DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Invoices Table
-- ============================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  stripe_invoice_id TEXT,
  amount NUMERIC(10, 2),
  status invoice_status NOT NULL DEFAULT 'open',
  invoice_url TEXT,
  invoice_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Admin Notes Table
-- ============================================
CREATE TABLE public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Helper Functions (SECURITY DEFINER)
-- ============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Check if user is pod owner
CREATE OR REPLACE FUNCTION public.is_pod_owner(_user_id UUID, _pod_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pods
    WHERE id = _pod_id
      AND owner_id = _user_id
  )
$$;

-- Check if user is pod member
CREATE OR REPLACE FUNCTION public.is_pod_member(_user_id UUID, _pod_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pod_members
    WHERE pod_id = _pod_id
      AND user_id = _user_id
      AND accepted_at IS NOT NULL
  )
$$;

-- Check if user can access pod data (owner or member)
CREATE OR REPLACE FUNCTION public.can_access_pod(_user_id UUID, _pod_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin(_user_id) OR 
    public.is_pod_owner(_user_id, _pod_id) OR 
    public.is_pod_member(_user_id, _pod_id)
$$;

-- Get user's accessible pod IDs
CREATE OR REPLACE FUNCTION public.get_user_pod_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.pods WHERE owner_id = _user_id
  UNION
  SELECT pod_id FROM public.pod_members WHERE user_id = _user_id AND accepted_at IS NOT NULL
$$;

-- ============================================
-- Triggers
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Default role is client
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create pod settings when pod is created
CREATE OR REPLACE FUNCTION public.handle_new_pod()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.pod_settings (pod_id)
  VALUES (NEW.id);
  
  -- Add owner as pod member with 'owner' role
  INSERT INTO public.pod_members (pod_id, user_id, role, accepted_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_pod_created
  AFTER INSERT ON public.pods
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_pod();

-- Update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_pods_updated_at
  BEFORE UPDATE ON public.pods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_pod_settings_updated_at
  BEFORE UPDATE ON public.pod_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_admin_notes_updated_at
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- User Roles: Admins can manage, users can read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid()));

-- Profiles: Users can read/update own, admins can manage all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));

-- Pods: Admins full access, owners full access, members read-only
CREATE POLICY "Admins can manage all pods" ON public.pods FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible pods" ON public.pods FOR SELECT USING (public.can_access_pod(auth.uid(), id));
CREATE POLICY "Owners can update own pods" ON public.pods FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Clients can create pods" ON public.pods FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own pods" ON public.pods FOR DELETE USING (owner_id = auth.uid());

-- Pod Members: Admins full access, owners can manage, members can read
CREATE POLICY "Admins can manage all pod members" ON public.pod_members FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read pod members for accessible pods" ON public.pod_members FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));
CREATE POLICY "Pod owners can manage members" ON public.pod_members FOR ALL USING (public.is_pod_owner(auth.uid(), pod_id));
CREATE POLICY "Members can leave pods" ON public.pod_members FOR DELETE USING (user_id = auth.uid());

-- Pod Settings: Admins full access, owners can manage, members read-only
CREATE POLICY "Admins can manage all pod settings" ON public.pod_settings FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible pod settings" ON public.pod_settings FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));
CREATE POLICY "Pod owners can update settings" ON public.pod_settings FOR UPDATE USING (public.is_pod_owner(auth.uid(), pod_id));

-- Call Logs: Admins full access, pod accessors can read, owners can manage
CREATE POLICY "Admins can manage all call logs" ON public.call_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible call logs" ON public.call_logs FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));
CREATE POLICY "Pod owners can manage call logs" ON public.call_logs FOR ALL USING (public.is_pod_owner(auth.uid(), pod_id));

-- Automation Modules: Admins full access, pod accessors can read, owners can manage
CREATE POLICY "Admins can manage all automation modules" ON public.automation_modules FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible automation modules" ON public.automation_modules FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));
CREATE POLICY "Pod owners can manage automation modules" ON public.automation_modules FOR ALL USING (public.is_pod_owner(auth.uid(), pod_id));

-- Automation Logs: Admins full access, pod accessors can read, owners can manage
CREATE POLICY "Admins can manage all automation logs" ON public.automation_logs FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible automation logs" ON public.automation_logs FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));
CREATE POLICY "Pod owners can manage automation logs" ON public.automation_logs FOR ALL USING (public.is_pod_owner(auth.uid(), pod_id));

-- Subscriptions: Admins full access, pod accessors can read
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible subscriptions" ON public.subscriptions FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));

-- Invoices: Admins full access, pod accessors can read
CREATE POLICY "Admins can manage all invoices" ON public.invoices FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can read accessible invoices" ON public.invoices FOR SELECT USING (public.can_access_pod(auth.uid(), pod_id));

-- Admin Notes: Admins only
CREATE POLICY "Admins can manage admin notes" ON public.admin_notes FOR ALL USING (public.is_admin(auth.uid()));

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_pods_owner_id ON public.pods(owner_id);
CREATE INDEX idx_pod_members_pod_id ON public.pod_members(pod_id);
CREATE INDEX idx_pod_members_user_id ON public.pod_members(user_id);
CREATE INDEX idx_call_logs_pod_id ON public.call_logs(pod_id);
CREATE INDEX idx_call_logs_call_started_at ON public.call_logs(call_started_at DESC);
CREATE INDEX idx_automation_logs_pod_id ON public.automation_logs(pod_id);
CREATE INDEX idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
CREATE INDEX idx_subscriptions_pod_id ON public.subscriptions(pod_id);
CREATE INDEX idx_invoices_pod_id ON public.invoices(pod_id);
CREATE INDEX idx_admin_notes_pod_id ON public.admin_notes(pod_id);