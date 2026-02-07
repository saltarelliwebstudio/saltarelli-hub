-- Add google_sheet_url column to retell_accounts
ALTER TABLE public.retell_accounts
ADD COLUMN google_sheet_url text DEFAULT NULL;