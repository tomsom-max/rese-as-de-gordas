-- Pega todo esto en Supabase: SQL Editor -> New query -> Run

-- 1. Tablas ---------------------------------------------------
create table fotos (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(titulo) <= 40),
  imagen text not null check (char_length(imagen) <= 500000),
  aprobada boolean not null default false,   -- un profesor la aprueba
  creada timestamptz not null default now()
);

create table comentarios (
  id bigint generated always as identity primary key,
  foto_id bigint not null references fotos(id) on delete cascade,
  nombre text not null check (char_length(nombre) <= 20),
  texto text not null check (char_length(texto) <= 150),
  aprobado boolean not null default true,    -- un profesor puede ocultarlo
  creado timestamptz not null default now()
);

create table votos (
  id bigint generated always as identity primary key,
  foto_id bigint not null references fotos(id) on delete cascade,
  votante text not null,
  estrellas int not null check (estrellas between 1 and 5),
  unique (foto_id, votante)                  -- un voto por navegador
);

-- 2. Reglas de seguridad (RLS) --------------------------------
alter table fotos enable row level security;
alter table comentarios enable row level security;
alter table votos enable row level security;

-- Los visitantes solo VEN fotos aprobadas y comentarios aprobados
create policy "ver fotos aprobadas" on fotos
  for select to anon using (aprobada = true);
create policy "ver comentarios aprobados" on comentarios
  for select to anon using (aprobado = true);
create policy "ver votos" on votos
  for select to anon using (true);

-- Los visitantes pueden AGREGAR, pero no editar ni borrar
create policy "subir fotos" on fotos
  for insert to anon with check (aprobada = false);
create policy "comentar" on comentarios
  for insert to anon with check (aprobado = true);
create policy "votar" on votos
  for insert to anon with check (true);
