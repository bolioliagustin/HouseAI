-- Create table for storing push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  auth text not null,
  p256dh text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  device_type text, -- 'mobile', 'desktop', etc.
  
  -- Ensure unique subscription per user/device combo (endpoint is unique per subscription)
  constraint unique_endpoint unique (endpoint)
);

-- RLS Policies
alter table public.push_subscriptions enable row level security;

create policy "Users can enable their own subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
  before update on public.push_subscriptions
  for each row
  execute procedure public.handle_updated_at();
