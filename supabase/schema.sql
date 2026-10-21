-- Timeline — the Supabase database (ARCHITECTURE.md §5). Run once in the SQL Editor (done 21 Oct 2026).
-- Every record of the plan (a category, phase, milestone or event) is one row. The record itself is
-- `data`; `updated_at` is its stamp (set on the device); `deleted` marks a deletion.
-- `synced_at` is when the row arrived, by the server's clock: devices ask "what's new since…" by it.
create table public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  list       text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null,
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index records_by_sync on public.records (user_id, synced_at);

-- only you can see and change your own rows (no delete: deletions are rows with deleted = true)
alter table public.records enable row level security;
create policy "read own"   on public.records for select to authenticated using (user_id = auth.uid());
create policy "add own"    on public.records for insert to authenticated with check (user_id = auth.uid());
create policy "change own" on public.records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- the server notes when a row arrived; an older version never overwrites a newer one
create function public.records_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_at := now();
  return new;
end $$;
create trigger records_before_write before insert or update on public.records
for each row execute function public.records_before_write();
