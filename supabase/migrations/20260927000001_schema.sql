-- Elite Systems platform — schema, row-level security and storage.
-- Every client sees only their own data; admins (profiles.role = 'admin') see everything.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type public.user_role          as enum ('client', 'admin');
create type public.account_status     as enum ('pending', 'active', 'blocked');
create type public.project_status     as enum ('active', 'paused', 'done', 'cancelled');
create type public.stage_status       as enum ('pending', 'in_progress', 'done');
create type public.approval_status    as enum ('pending', 'approved', 'changes_requested');
create type public.file_category      as enum ('contrato', 'prototipo', 'entrega', 'manual', 'outro');
create type public.installment_status as enum ('pending', 'paid', 'cancelled');
create type public.ticket_status      as enum ('open', 'in_progress', 'waiting_client', 'resolved', 'closed');
create type public.ticket_priority    as enum ('low', 'normal', 'high', 'urgent');
create type public.request_status     as enum ('new', 'in_review', 'converted', 'declined');

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text not null default '',
  company         text not null default '',
  phone           text not null default '',
  role            public.user_role not null default 'client',
  status          public.account_status not null default 'pending',
  notify_email    boolean not null default true,
  notify_whatsapp boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Accounts created with one of these e-mails become admins automatically.
create table public.admin_emails (email text primary key);
insert into public.admin_emails (email) values ('elitesystems.br@gmail.com');

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(name) between 2 and 120),
  summary     text not null default '',
  kind        text not null default '',
  status      public.project_status not null default 'active',
  staging_url text not null default '',
  start_date  date,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.project_stages (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  position     int  not null,
  name         text not null,
  description  text not null default '',
  status       public.stage_status not null default 'pending',
  progress     int  not null default 0 check (progress between 0 and 100),
  due_date     date,
  started_at   timestamptz,
  completed_at timestamptz,
  unique (project_id, position)
);

create table public.project_updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id   uuid references public.project_stages (id) on delete set null,
  author_id  uuid references public.profiles (id) on delete set null,
  title      text not null check (length(title) between 2 and 160),
  body       text not null default '',
  created_at timestamptz not null default now()
);

create table public.files (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  name         text not null,
  storage_path text not null unique,
  size         bigint not null default 0,
  mime         text not null default '',
  category     public.file_category not null default 'outro',
  created_at   timestamptz not null default now()
);

create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  stage_id      uuid references public.project_stages (id) on delete set null,
  file_id       uuid references public.files (id) on delete set null,
  title         text not null check (length(title) between 2 and 160),
  description   text not null default '',
  link_url      text not null default '',
  status        public.approval_status not null default 'pending',
  requested_by  uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  decided_by    uuid references public.profiles (id) on delete set null,
  decided_at    timestamptz,
  decision_note text not null default ''
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.project_reads (
  project_id   uuid not null references public.projects (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.installments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  number       int  not null check (number > 0),
  description  text not null default '',
  amount_cents int  not null check (amount_cents > 0),
  due_date     date not null,
  status       public.installment_status not null default 'pending',
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table public.settings (
  id               int primary key default 1 check (id = 1),
  pix_key          text not null default '',
  pix_name         text not null default 'ELITE SYSTEMS',
  pix_city         text not null default 'CURITIBA',
  support_whatsapp text not null default '5541995758534',
  updated_at       timestamptz not null default now()
);
insert into public.settings (id) values (1);

create table public.tickets (
  id         uuid primary key default gen_random_uuid(),
  number     bigint generated always as identity,
  client_id  uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  subject    text not null check (length(subject) between 3 and 160),
  priority   public.ticket_priority not null default 'normal',
  status     public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.project_requests (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  types      text[] not null default '{}',
  team_size  text not null default '',
  priority   text not null default '',
  budget     text not null default '',
  deadline   text not null default '',
  context    text not null default '',
  status     public.request_status not null default 'new',
  project_id uuid references public.projects (id) on delete set null,
  admin_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null default '',
  link        text not null default '',
  read_at     timestamptz,
  emailed_at  timestamptz,
  whatsapp_at timestamptz,
  created_at  timestamptz not null default now()
);

create index on public.projects (client_id);
create index on public.project_stages (project_id);
create index on public.project_updates (project_id, created_at desc);
create index on public.files (project_id, created_at desc);
create index on public.approvals (project_id, created_at desc);
create index on public.messages (project_id, created_at);
create index on public.installments (project_id, due_date);
create index on public.tickets (client_id, updated_at desc);
create index on public.ticket_messages (ticket_id, created_at);
create index on public.project_requests (client_id, created_at desc);
create index on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

create or replace function public.can_access_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.projects where id = p and client_id = auth.uid());
$$;

create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger tickets_touch  before update on public.tickets  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- New auth user -> profile (admins come from admin_emails).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adm boolean;
begin
  select exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) into adm;
  insert into public.profiles (id, email, full_name, company, phone, role, status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case when adm then 'admin'::public.user_role else 'client'::public.user_role end,
    case when adm then 'active'::public.account_status else 'pending'::public.account_status end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Clients may edit their own profile but never their role, status or e-mail.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role   := old.role;
    new.status := old.status;
    new.email  := old.email;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- Every project starts with the five Elite Systems stages.
create or replace function public.create_default_stages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_stages (project_id, position, name, description) values
    (new.id, 1, 'Diagnóstico',     'Mapeamento do fluxo real da empresa e do que precisa de controle.'),
    (new.id, 2, 'Protótipo',       'Telas navegáveis para você aprovar antes do código.'),
    (new.id, 3, 'Desenvolvimento', 'Entregas semanais em ambiente de testes.'),
    (new.id, 4, 'Implantação',     'Migração de dados, treinamento e sistema no ar.'),
    (new.id, 5, 'Evolução',        'Suporte próximo e melhorias contínuas.');
  return new;
end $$;

create trigger projects_default_stages
  after insert on public.projects for each row execute function public.create_default_stages();

-- Stage timestamps follow status changes.
create or replace function public.stage_timestamps() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'in_progress' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
      new.progress := 100;
      new.started_at := coalesce(new.started_at, now());
    end if;
    if new.status = 'pending' then new.started_at := null; new.completed_at := null; new.progress := 0; end if;
  end if;
  return new;
end $$;

create trigger stages_timestamps before update on public.project_stages for each row execute function public.stage_timestamps();

-- The client's only write on approvals: decide a pending one.
create or replace function public.decide_approval(p_id uuid, p_decision public.approval_status, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.approvals;
begin
  select * into a from public.approvals where id = p_id;
  if a.id is null or not public.can_access_project(a.project_id) then
    raise exception 'Aprovação não encontrada';
  end if;
  if a.status <> 'pending' then
    raise exception 'Esta aprovação já foi respondida';
  end if;
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Decisão inválida';
  end if;
  update public.approvals
     set status = p_decision, decided_by = auth.uid(), decided_at = now(), decision_note = coalesce(p_note, '')
   where id = p_id;
end $$;

-- Replies move the ticket along: admin reply -> waiting on client, client reply -> back in the queue.
create or replace function public.ticket_after_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.tickets;
  author_admin boolean;
begin
  select * into t from public.tickets where id = new.ticket_id;
  select role = 'admin' into author_admin from public.profiles where id = new.author_id;
  if author_admin and t.status in ('open', 'in_progress') then
    update public.tickets set status = 'waiting_client' where id = t.id;
  elsif not author_admin and t.status in ('waiting_client', 'resolved') then
    update public.tickets set status = 'open' where id = t.id;
  else
    update public.tickets set updated_at = now() where id = t.id;
  end if;
  return new;
end $$;

create trigger ticket_messages_after after insert on public.ticket_messages for each row execute function public.ticket_after_message();

-- ---------------------------------------------------------------- row-level security
alter table public.profiles         enable row level security;
alter table public.admin_emails     enable row level security;
alter table public.projects         enable row level security;
alter table public.project_stages   enable row level security;
alter table public.project_updates  enable row level security;
alter table public.files            enable row level security;
alter table public.approvals        enable row level security;
alter table public.messages         enable row level security;
alter table public.project_reads    enable row level security;
alter table public.installments     enable row level security;
alter table public.settings         enable row level security;
alter table public.tickets          enable row level security;
alter table public.ticket_messages  enable row level security;
alter table public.project_requests enable row level security;
alter table public.notifications    enable row level security;

create policy "profiles: self or admin read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: self or admin update" on public.profiles for update using (id = auth.uid() or public.is_admin());

create policy "projects: read"  on public.projects for select using (client_id = auth.uid() or public.is_admin());
create policy "projects: admin" on public.projects for all using (public.is_admin()) with check (public.is_admin());

create policy "stages: read"  on public.project_stages for select using (public.can_access_project(project_id));
create policy "stages: admin" on public.project_stages for all using (public.is_admin()) with check (public.is_admin());

create policy "updates: read"  on public.project_updates for select using (public.can_access_project(project_id));
create policy "updates: admin" on public.project_updates for all using (public.is_admin()) with check (public.is_admin());

create policy "files: read"   on public.files for select using (public.can_access_project(project_id));
create policy "files: upload" on public.files for insert with check (public.can_access_project(project_id) and uploaded_by = auth.uid());
create policy "files: delete" on public.files for delete using (public.is_admin() or uploaded_by = auth.uid());

create policy "approvals: read"  on public.approvals for select using (public.can_access_project(project_id));
create policy "approvals: admin" on public.approvals for all using (public.is_admin()) with check (public.is_admin());

create policy "messages: read"  on public.messages for select using (public.can_access_project(project_id));
create policy "messages: write" on public.messages for insert with check (public.can_access_project(project_id) and author_id = auth.uid());
create policy "messages: admin delete" on public.messages for delete using (public.is_admin());

create policy "reads: own" on public.project_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_access_project(project_id));

create policy "installments: read"  on public.installments for select using (public.can_access_project(project_id));
create policy "installments: admin" on public.installments for all using (public.is_admin()) with check (public.is_admin());

create policy "settings: read"  on public.settings for select using (auth.uid() is not null);
create policy "settings: admin" on public.settings for update using (public.is_admin()) with check (public.is_admin());

create policy "tickets: read"   on public.tickets for select using (client_id = auth.uid() or public.is_admin());
create policy "tickets: open"   on public.tickets for insert with check (
  client_id = auth.uid() and public.is_active()
  and (project_id is null or public.can_access_project(project_id)));
create policy "tickets: admin"  on public.tickets for update using (public.is_admin()) with check (public.is_admin());

create policy "ticket_messages: read" on public.ticket_messages for select using (
  exists (select 1 from public.tickets t where t.id = ticket_id and (t.client_id = auth.uid() or public.is_admin())));
create policy "ticket_messages: write" on public.ticket_messages for insert with check (
  author_id = auth.uid()
  and exists (select 1 from public.tickets t where t.id = ticket_id and (t.client_id = auth.uid() or public.is_admin())));

create policy "requests: read"   on public.project_requests for select using (client_id = auth.uid() or public.is_admin());
create policy "requests: create" on public.project_requests for insert with check (client_id = auth.uid());
create policy "requests: admin"  on public.project_requests for update using (public.is_admin()) with check (public.is_admin());

create policy "notifications: own read"   on public.notifications for select using (user_id = auth.uid());
create policy "notifications: own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

create policy "project files: read" on storage.objects for select using (
  bucket_id = 'project-files' and public.can_access_project(public.try_uuid((storage.foldername(name))[1])));
create policy "project files: upload" on storage.objects for insert with check (
  bucket_id = 'project-files' and public.can_access_project(public.try_uuid((storage.foldername(name))[1])));
create policy "project files: delete" on storage.objects for delete using (
  bucket_id = 'project-files' and (public.is_admin() or owner_id = auth.uid()::text));

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.messages, public.ticket_messages, public.notifications;
