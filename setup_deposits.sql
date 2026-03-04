-- 1. Create the deposits table
create table deposits (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  transaction_id text,
  amount numeric,
  status text default 'PENDING',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Enable Row Level Security (RLS)
alter table deposits enable row level security;

-- 3. Create policies (Allow public select for realtime, but restrict inserts/updates to admin/service role)
create policy "Public read deposits" on deposits for select using (true);

-- 4. Enable Realtime for the deposits table
-- Go to Supabase Dashboard -> Database -> Replication -> Tables -> Toggle 'deposits'
-- Or run this SQL:
begin;
  -- remove the table from the publication if it exists
  alter publication supabase_realtime reduce table deposits;
  -- add the table to the publication
  alter publication supabase_realtime add table deposits;
commit;
