-- Timeline — push reminders (ARCHITECTURE.md §5.5). Run once in the SQL Editor, after schema.sql.
-- push_devices    one row per device that turned reminders on: where to send (the push service's
--                 address for that device) and how to encrypt for it. Written by the app.
-- reminders_sent  which reminder already went to which device, so none goes out twice.
--                 Only the server function touches it.
create table public.push_devices (
  endpoint   text        primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text        not null,
  auth       text        not null,
  time_zone  text        not null default 'Europe/Vienna',
  created_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
create policy "read own"   on public.push_devices for select to authenticated using (user_id = auth.uid());
create policy "add own"    on public.push_devices for insert to authenticated with check (user_id = auth.uid());
create policy "change own" on public.push_devices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own" on public.push_devices for delete to authenticated using (user_id = auth.uid());

create table public.reminders_sent (
  endpoint text        not null references public.push_devices (endpoint) on delete cascade,
  key      text        not null,              -- "<event id>@<date>"
  sent_at  timestamptz not null default now(),
  primary key (endpoint, key)
);
alter table public.reminders_sent enable row level security;   -- no policies: the app can't read or write it

-- every minute, call the function that sends what is due
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;
select cron.schedule('send-reminders', '* * * * *', $$
  select net.http_post(
    url     := 'https://vkdrhvnpmuelckwnafpu.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_0GeBfnRUVWl8sU1aqygttg_JfGH02NU"}'::jsonb,
    body    := '{}'::jsonb)
$$);
-- to stop it:  select cron.unschedule('send-reminders');
