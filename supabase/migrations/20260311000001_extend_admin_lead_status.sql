-- Extend admin_lead_status enum with new funnel-tracking values
-- Run this in the Supabase SQL editor if not applied automatically

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'replied'
      AND enumtypid = 'public.admin_lead_status'::regtype
  ) THEN
    ALTER TYPE public.admin_lead_status ADD VALUE 'replied';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'demo_booked'
      AND enumtypid = 'public.admin_lead_status'::regtype
  ) THEN
    ALTER TYPE public.admin_lead_status ADD VALUE 'demo_booked';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'do_not_contact'
      AND enumtypid = 'public.admin_lead_status'::regtype
  ) THEN
    ALTER TYPE public.admin_lead_status ADD VALUE 'do_not_contact';
  END IF;
END$$;
