-- Workshop signups table (separate from admin_leads — these are workshop attendees, not sales leads)
create table if not exists public.workshop_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  workshop_name text not null default 'AI Systems for Business Owners',
  workshop_date date,
  source text not null default 'saltarelliwebstudio.ca',
  attended boolean not null default false,
  notes text
);

alter table public.workshop_signups enable row level security;

-- Admins can do everything (read, insert, update, delete)
drop policy if exists "Admins can manage workshop signups" on public.workshop_signups;
create policy "Admins can manage workshop signups"
  on public.workshop_signups for all
  using (public.is_admin(auth.uid()));

-- Indexes for admin UI list + dedup lookups
create index if not exists workshop_signups_created_at_idx
  on public.workshop_signups (created_at desc);
create index if not exists workshop_signups_email_idx
  on public.workshop_signups (email);
create index if not exists workshop_signups_workshop_date_idx
  on public.workshop_signups (workshop_date);
