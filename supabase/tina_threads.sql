create table if not exists public.tina_threads (
  id text primary key,
  workspace_id text not null default 'local',
  title text not null,
  time_label text not null default 'Just now',
  messages jsonb not null default '[]'::jsonb,
  latest_synthesis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tina_threads_workspace_updated_idx
  on public.tina_threads (workspace_id, updated_at desc);
