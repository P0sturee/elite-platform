-- In-app notifications for every event that matters, plus delivery to e-mail/WhatsApp
-- through the app's /api/notify route (called with pg_net once private.config is filled in).

create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (
  key   text primary key,
  value text not null
);

-- ---------------------------------------------------------------- helpers
create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 400), coalesce(p_link, ''));
end $$;

create or replace function public.notify_admins(p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select id, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 400), coalesce(p_link, '')
    from public.profiles where role = 'admin';
end $$;

revoke execute on function public.notify_user(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;

create or replace function public.display_name(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(company, ''), nullif(full_name, ''), email) from public.profiles where id = p;
$$;

-- ---------------------------------------------------------------- event triggers
create or replace function public.tg_notify_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'client' then
      perform public.notify_admins('signup', 'Novo cadastro: ' || coalesce(nullif(new.full_name, ''), new.email),
        'Conta aguardando aprovação.', '/admin/clientes');
    end if;
  elsif new.status = 'active' and old.status = 'pending' then
    perform public.notify_user(new.id, 'account', 'Sua conta foi aprovada',
      'Agora você já pode acompanhar seus projetos na plataforma.', '/painel');
  end if;
  return new;
end $$;
create trigger profiles_notify after insert or update of status on public.profiles
  for each row execute function public.tg_notify_profile();

create or replace function public.tg_notify_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_user(new.client_id, 'project', 'Seu projeto ' || new.name || ' foi criado',
    'Acompanhe as etapas, aprovações e entregas por aqui.', '/projetos/' || new.id);
  return new;
end $$;
create trigger projects_notify after insert on public.projects
  for each row execute function public.tg_notify_project();

create or replace function public.tg_notify_stage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
begin
  if new.status is not distinct from old.status or new.status = 'pending' then return new; end if;
  select * into p from public.projects where id = new.project_id;
  perform public.notify_user(p.client_id, 'stage',
    case when new.status = 'done' then 'Etapa concluída: ' else 'Etapa iniciada: ' end || new.name,
    p.name, '/projetos/' || p.id);
  return new;
end $$;
create trigger stages_notify after update of status on public.project_stages
  for each row execute function public.tg_notify_stage();

create or replace function public.tg_notify_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
begin
  select * into p from public.projects where id = new.project_id;
  perform public.notify_user(p.client_id, 'update', new.title, p.name, '/projetos/' || p.id);
  return new;
end $$;
create trigger updates_notify after insert on public.project_updates
  for each row execute function public.tg_notify_update();

create or replace function public.tg_notify_approval() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
begin
  select * into p from public.projects where id = new.project_id;
  if tg_op = 'INSERT' then
    perform public.notify_user(p.client_id, 'approval', 'Aprovação pendente: ' || new.title,
      p.name, '/projetos/' || p.id || '/aprovacoes');
  elsif old.status = 'pending' and new.status <> 'pending' then
    perform public.notify_admins('approval_decided',
      public.display_name(p.client_id) ||
      case when new.status = 'approved' then ' aprovou: ' else ' pediu ajustes em: ' end || new.title,
      coalesce(nullif(new.decision_note, ''), p.name), '/projetos/' || p.id || '/aprovacoes');
  end if;
  return new;
end $$;
create trigger approvals_notify after insert or update of status on public.approvals
  for each row execute function public.tg_notify_approval();

create or replace function public.tg_notify_file() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
begin
  select * into p from public.projects where id = new.project_id;
  if exists (select 1 from public.profiles where id = new.uploaded_by and role = 'admin') then
    perform public.notify_user(p.client_id, 'file', 'Novo arquivo: ' || new.name, p.name, '/projetos/' || p.id || '/arquivos');
  else
    perform public.notify_admins('file', public.display_name(p.client_id) || ' enviou ' || new.name, p.name,
      '/projetos/' || p.id || '/arquivos');
  end if;
  return new;
end $$;
create trigger files_notify after insert on public.files
  for each row execute function public.tg_notify_file();

-- Messages: at most one unread notification per conversation every 15 minutes.
create or replace function public.tg_notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
  v_link text;
  v_title text;
begin
  select * into p from public.projects where id = new.project_id;
  v_link := '/projetos/' || p.id || '/mensagens';
  if exists (select 1 from public.profiles where id = new.author_id and role = 'admin') then
    if not exists (select 1 from public.notifications n
                    where n.user_id = p.client_id and n.kind = 'message' and n.link = v_link
                      and n.read_at is null and n.created_at > now() - interval '15 minutes') then
      perform public.notify_user(p.client_id, 'message', 'Nova mensagem da Elite Systems', left(new.body, 140), v_link);
    end if;
  else
    v_title := 'Mensagem de ' || public.display_name(p.client_id);
    insert into public.notifications (user_id, kind, title, body, link)
    select a.id, 'message', v_title, left(new.body, 140), v_link
      from public.profiles a
     where a.role = 'admin'
       and not exists (select 1 from public.notifications n
                        where n.user_id = a.id and n.kind = 'message' and n.link = v_link
                          and n.read_at is null and n.created_at > now() - interval '15 minutes');
  end if;
  return new;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.tg_notify_message();

create or replace function public.tg_notify_installment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.projects;
  v_amount text;
begin
  select * into p from public.projects where id = new.project_id;
  v_amount := 'R$ ' || replace(replace(replace(to_char(new.amount_cents / 100.0, 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.');
  if tg_op = 'INSERT' then
    perform public.notify_user(p.client_id, 'invoice', 'Nova parcela ' || new.number || ': ' || v_amount,
      'Vencimento em ' || to_char(new.due_date, 'DD/MM/YYYY') || ' · ' || p.name, '/projetos/' || p.id || '/financeiro');
  elsif new.status = 'paid' and old.status <> 'paid' then
    perform public.notify_user(p.client_id, 'payment', 'Pagamento confirmado: parcela ' || new.number,
      v_amount || ' · ' || p.name, '/projetos/' || p.id || '/financeiro');
  end if;
  return new;
end $$;
create trigger installments_notify after insert or update of status on public.installments
  for each row execute function public.tg_notify_installment();

create or replace function public.tg_notify_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admins('ticket', 'Novo chamado #' || new.number || ': ' || new.subject,
    public.display_name(new.client_id) || ' · prioridade ' || new.priority, '/suporte/' || new.id);
  return new;
end $$;
create trigger tickets_notify after insert on public.tickets
  for each row execute function public.tg_notify_ticket();

create or replace function public.tg_notify_ticket_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  -- the first message is the ticket description; the ticket insert already notified
  if (select count(*) from public.ticket_messages where ticket_id = t.id) = 1 then return new; end if;
  if exists (select 1 from public.profiles where id = new.author_id and role = 'admin') then
    perform public.notify_user(t.client_id, 'ticket_reply', 'Resposta no chamado #' || t.number, left(new.body, 140), '/suporte/' || t.id);
  else
    perform public.notify_admins('ticket_reply', 'Cliente respondeu o chamado #' || t.number, left(new.body, 140), '/suporte/' || t.id);
  end if;
  return new;
end $$;
create trigger ticket_messages_notify after insert on public.ticket_messages
  for each row execute function public.tg_notify_ticket_message();

create or replace function public.tg_notify_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admins('request', 'Novo pedido de projeto: ' || public.display_name(new.client_id),
    array_to_string(new.types, ' + '), '/admin/pedidos');
  return new;
end $$;
create trigger requests_notify after insert on public.project_requests
  for each row execute function public.tg_notify_request();

-- ---------------------------------------------------------------- delivery (e-mail / WhatsApp)
-- Fill in once the app is deployed:
--   insert into private.config values ('app_url', 'https://SEU-APP.vercel.app'), ('notify_secret', '<mesmo NOTIFY_SECRET da Vercel>')
--   on conflict (key) do update set value = excluded.value;
create or replace function private.dispatch_notification() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.config where key = 'app_url';
  select value into v_secret from private.config where key = 'notify_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/notify',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret)
  );
  return new;
end $$;

create trigger notifications_dispatch after insert on public.notifications
  for each row execute function private.dispatch_notification();
