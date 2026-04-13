-- Security fix: Remove overly permissive USING(true) RLS policies
-- These policies grant access to ALL authenticated users (including anon key),
-- not just service_role as intended. Service role already bypasses RLS by default.

-- Fix sms_drip_log: was open to all authenticated users
DROP POLICY IF EXISTS "Service role full access on sms_drip_log" ON public.sms_drip_log;

-- Fix content engine tables: were open to all authenticated users
DROP POLICY IF EXISTS "Service role full access on drive_watch_state" ON public.drive_watch_state;
DROP POLICY IF EXISTS "Service role full access on publish_queue" ON public.publish_queue;
DROP POLICY IF EXISTS "Service role full access on description_templates" ON public.description_templates;
DROP POLICY IF EXISTS "Service role full access on content_ideas" ON public.content_ideas;
DROP POLICY IF EXISTS "Service role full access on content_scripts" ON public.content_scripts;

-- Add proper admin-only policies for content engine tables
CREATE POLICY "Admins can manage drive_watch_state"
  ON public.drive_watch_state FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage publish_queue"
  ON public.publish_queue FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage description_templates"
  ON public.description_templates FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage content_ideas"
  ON public.content_ideas FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage content_scripts"
  ON public.content_scripts FOR ALL
  USING (public.is_admin(auth.uid()));

-- Add admin-only read policy for sms_drip_log (admins need to see drip status)
CREATE POLICY "Admins can read sms_drip_log"
  ON public.sms_drip_log FOR SELECT
  USING (public.is_admin(auth.uid()));
