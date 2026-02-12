-- Create direct_messages table for client-admin messaging
create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  pod_id uuid not null references public.pods(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_direct_messages_pod_id on public.direct_messages(pod_id);
create index idx_direct_messages_sender_id on public.direct_messages(sender_id);
create index idx_direct_messages_recipient_id on public.direct_messages(recipient_id);
create index idx_direct_messages_created_at on public.direct_messages(created_at desc);
create index idx_direct_messages_unread on public.direct_messages(recipient_id, read) where read = false;

-- Enable RLS
alter table public.direct_messages enable row level security;

-- RLS policies

-- Admin can see all messages
create policy "Admins can view all direct messages"
  on public.direct_messages for select
  using (public.is_admin(auth.uid()));

-- Admin can insert messages to any pod
create policy "Admins can send direct messages"
  on public.direct_messages for insert
  with check (public.is_admin(auth.uid()) and sender_id = auth.uid());

-- Admin can update (mark as read) any message sent to them
create policy "Admins can mark messages as read"
  on public.direct_messages for update
  using (public.is_admin(auth.uid()) and recipient_id = auth.uid());

-- Clients can view their own messages (sent or received)
create policy "Users can view their own messages"
  on public.direct_messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Clients can send messages
create policy "Users can send direct messages"
  on public.direct_messages for insert
  with check (sender_id = auth.uid());

-- Users can mark messages sent to them as read
create policy "Users can mark their messages as read"
  on public.direct_messages for update
  using (recipient_id = auth.uid());

-- Enable realtime for direct_messages
alter publication supabase_realtime add table public.direct_messages;
