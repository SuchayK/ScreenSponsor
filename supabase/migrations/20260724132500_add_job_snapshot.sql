alter table public.jobs
  add column if not exists snapshot jsonb not null default '{}'::jsonb;

create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);

revoke all on table public.jobs from anon, authenticated;
grant select, insert, update, delete on table public.jobs to service_role;
