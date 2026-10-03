create table if not exists public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  unit_id text not null,
  listens_count integer not null default 0 check (listens_count >= 0),
  passage_unlocked boolean not null default false,
  completed boolean not null default false,
  vocabulary_progress jsonb not null default '{}'::jsonb,
  speaking_progress jsonb not null default '{}'::jsonb,
  grammar_completed boolean not null default false,
  ai_practice_completed boolean not null default false,
  review_completed boolean not null default false,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint progress_user_unit_unique primary key (user_id, unit_id)
);

create index if not exists progress_updated_at_idx on public.progress (user_id, updated_at desc);

alter table public.progress enable row level security;
revoke all on table public.progress from anon, authenticated;
grant select, insert, update on table public.progress to authenticated;

create policy "Users can read their own progress"
  on public.progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own progress"
  on public.progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own progress"
  on public.progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_progress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists progress_updated_at on public.progress;
create trigger progress_updated_at
  before update on public.progress
  for each row execute function public.set_progress_updated_at();
