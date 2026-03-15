-- Auto-activate drip when a new lead is inserted with a phone number
CREATE OR REPLACE FUNCTION public.auto_activate_drip()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.drip_active = false THEN
    NEW.drip_active := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_drip_on_insert
  BEFORE INSERT ON public.admin_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_activate_drip();
