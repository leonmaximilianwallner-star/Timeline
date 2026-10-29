-- Timeline — push reminders (ARCHITECTURE.md §5.5). Run in the SQL Editor, after schema.sql.
-- Safe to run again: everything checks whether it exists first.
-- Run PART 1 on its own first (select it, Run), then PART 2. If PART 2 fails, PART 1 stays.
-- (29 Oct: run as one, a failing extension line undid the whole script, tables included.)

-- ═══ PART 1 — the two tables ═══════════════════════════════════════════════════════════════
-- push_devices    one row per device that turned reminders on: where to send (the push service's
--                 address for that device) and how to encrypt for it. Written by the app.
-- reminders_sent  which reminder already went to which device, so none goes out twice.
--                 Only the server function touches it.
create table if not exists public.push_devices (
  endpoint   text        primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  time_zone  text        not null default 'Europe/Vienna',
  created_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
drop policy if exists "read own"   on public.push_devices;
drop policy if exists "add own"    on public.push_devices;
drop policy if exists "change own" on public.push_devices;
drop policy if exists "remove own" on public.push_devices;
create policy "read own"   on public.push_devices for select to authenticated using (user_id = auth.uid());
create policy "add own"    on public.push_devices for insert to authenticated with check (user_id = auth.uid());
create policy "change own" on public.push_devices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own" on public.push_devices for delete to authenticated using (user_id = auth.uid());

create table if not exists public.reminders_sent (
  endpoint text        not null references public.push_devices (endpoint) on delete cascade,
  key      text        not null,              -- "<event id>@<date>"
  sent_at  timestamptz not null default now(),
  primary key (endpoint, key)
);
alter table public.reminders_sent enable row level security;   -- no policies: the app can't read or write it

notify pgrst, 'reload schema';                                  -- the API sees the new tables at once

-- ═══ PART 2 — every minute, call the function that sends what is due ═══════════════════════
-- If this fails with "extension ... not available": Database → Extensions, switch on pg_cron and
-- pg_net there, then run PART 2 again.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;
select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');
select cron.schedule('send-reminders', '* * * * *', $$
  select net.http_post(
    url     := 'https://vkdrhvnpmuelckwnafpu.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_0GeBfnRUVWl8sU1aqygttg_JfGH02NU"}'::jsonb,
    body    := '{}'::jsonb)
$$);
-- check:   select jobname, schedule, active from cron.job;
-- to stop: select cron.unschedule('send-reminders');
