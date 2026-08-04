-- Ejecutar en Supabase: Dashboard -> tu proyecto -> SQL Editor -> New query -> pegar y Run

create table if not exists public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  raw_transcript text,
  summary text,
  insights jsonb,
  duration_seconds integer,
  language text default 'es',
  created_at timestamptz default now()
);

-- Si ya habías creado la tabla antes de que existiera esta columna, esto la agrega sin borrar nada:
alter table public.transcriptions add column if not exists duration_seconds integer;

-- Row Level Security: cada usuario solo ve/edita sus propias transcripciones
alter table public.transcriptions enable row level security;

drop policy if exists "Los usuarios pueden ver sus propias transcripciones" on public.transcriptions;
create policy "Los usuarios pueden ver sus propias transcripciones"
  on public.transcriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Los usuarios pueden crear sus propias transcripciones" on public.transcriptions;
create policy "Los usuarios pueden crear sus propias transcripciones"
  on public.transcriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Los usuarios pueden borrar sus propias transcripciones" on public.transcriptions;
create policy "Los usuarios pueden borrar sus propias transcripciones"
  on public.transcriptions for delete
  using (auth.uid() = user_id);
