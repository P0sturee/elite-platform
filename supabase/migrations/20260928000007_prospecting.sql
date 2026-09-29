-- Prospecção automática do OrçaPro: o robô busca empresas no Google Places, manda uma mensagem pelo WhatsApp
-- (Evolution API, mesmo número da Elite) e a IA responde e qualifica. Quem tem interesse passa para o admin
-- marcar a apresentação. Tudo é só do admin (RLS); as chaves do Google e da Anthropic ficam no Vault.

create extension if not exists pg_cron;

create type public.lead_status as enum (
  'new', 'contacted', 'replied', 'interested', 'meeting', 'not_interested', 'opted_out', 'no_whatsapp', 'error'
);

-- ---------------------------------------------------------------- tables
create table public.prospect_searches (
  id          uuid primary key default gen_random_uuid(),
  query       text not null check (length(query) between 3 and 120),   -- ex.: "eletricista em Curitiba"
  active      boolean not null default true,
  page_token  text,
  pages       int not null default 0,
  exhausted   boolean not null default false,
  found       int not null default 0,
  last_error  text not null default '',
  last_run_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index prospect_searches_query_idx on public.prospect_searches (lower(query));

create table public.prospect_leads (
  id              uuid primary key default gen_random_uuid(),
  search_id       uuid references public.prospect_searches (id) on delete set null,
  place_id        text not null unique,
  name            text not null,
  phone           text not null,                    -- 55 + DDD + celular
  wa_jid          text not null default '',
  category        text not null default '',
  address         text not null default '',
  website         text not null default '',
  maps_url        text not null default '',
  rating          numeric(2,1),
  reviews         int,
  status          public.lead_status not null default 'new',
  bot_paused      boolean not null default false,   -- você assumiu a conversa: o robô não responde mais
  bot_turns       int not null default 0,
  summary         text not null default '',
  error           text not null default '',
  contacted_at    timestamptz,
  last_inbound_at timestamptz,
  reply_due_at    timestamptz,                      -- quando a IA responde (espera o lead terminar de digitar)
  handoff_at      timestamptz,                      -- quando o robô passou a conversa para você
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index prospect_leads_phone_idx on public.prospect_leads (phone);
create index prospect_leads_status_idx on public.prospect_leads (status, created_at);
create index prospect_leads_contacted_idx on public.prospect_leads (contacted_at);
create index prospect_leads_due_idx on public.prospect_leads (reply_due_at) where reply_due_at is not null;

create table public.prospect_messages (
  id         bigserial primary key,
  lead_id    uuid not null references public.prospect_leads (id) on delete cascade,
  direction  text not null check (direction in ('in', 'out')),
  author     text not null check (author in ('lead', 'bot', 'admin')),
  body       text not null,
  wa_id      text,
  created_at timestamptz not null default now()
);
create unique index prospect_messages_wa_idx on public.prospect_messages (wa_id) where wa_id is not null;
create index prospect_messages_lead_idx on public.prospect_messages (lead_id, created_at);

create table public.prospect_settings (
  id              int primary key default 1 check (id = 1),
  enabled         boolean not null default false,
  daily_max       int not null default 30 check (daily_max between 5 and 60),
  window_start    int not null default 9 check (window_start between 6 and 20),
  window_end      int not null default 18 check (window_end between 8 and 22),
  weekdays_only   boolean not null default true,
  warmup_started  date,                             -- 1º dia de envio: o limite diário sobe aos poucos a partir dele
  next_send_at    timestamptz,
  paused_reason   text not null default '',
  send_errors     int not null default 0,
  tick_lock_until timestamptz,
  sender_name     text not null default '',
  openers         text[] not null default array[
    'Oi, tudo bem? Aqui é o {nome}, do OrçaPro. Vi a {empresa} no Google Maps e queria te apresentar rapidinho um sistema que junta orçamento em PDF, ordem de serviço, financeiro, estoque e WhatsApp num lugar só. Faz sentido eu te mostrar numa apresentação online de 15 minutos? (Se preferir não receber mensagens, é só responder SAIR.)',
    '{saudacao}! Sou o {nome}, do OrçaPro. Encontrei a {empresa} no Google e acho que nosso sistema pode ajudar: orçamentos profissionais em segundos, controle de estoque e do financeiro, tudo integrado ao WhatsApp. Posso te mostrar como funciona numa demonstração rápida pela internet? Se não tiver interesse, responda SAIR que eu não te chamo mais.',
    '{saudacao}, tudo certo por aí? Me chamo {nome} e trabalho com o OrçaPro, um sistema de gestão para empresas como a {empresa}: orçamentos, ordens de serviço, estoque, financeiro e CRM no mesmo lugar. Toparia ver uma apresentação online de 15 minutos? (Para não receber mais mensagens, responda SAIR.)'
  ],
  pitch           text not null default 'O OrçaPro (orcapro.site) é um sistema de gestão empresarial completo para negócios de qualquer porte e segmento: "Seu negócio inteiro, sob controle".
Módulos:
- Orçamentos e recibos: documentos profissionais em PDF, comprovantes e recibos de venda.
- Ordens de serviço: acompanha cada serviço da abertura à entrega, com histórico e garantia.
- WhatsApp integrado: conversa com os clientes e envia documentos sem sair do sistema.
- CRM completo: clientes, notas, histórico, lembretes e follow-ups.
- Produtos e serviços: catálogo organizado e apresentação profissional da oferta.
- Estoque em dia: quantidades por unidade e alertas de estoque baixo.
- Controle financeiro: entradas, saídas, fluxo de caixa, custos e lucro real.
- Equipe e multiempresa: funcionários, jornada, permissões, empresas e unidades.
- Fiscal e relatórios: integra notas fiscais e mostra indicadores para decidir com segurança.
Dá para criar uma conta grátis em orcapro.site; os planos e preços estão em "Ver planos" no site.',
  updated_at      timestamptz not null default now(),
  check (window_end > window_start)
);
insert into public.prospect_settings (id) values (1);

create trigger prospect_leads_touch    before update on public.prospect_leads    for each row execute function public.touch_updated_at();
create trigger prospect_settings_touch before update on public.prospect_settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS: admin only
alter table public.prospect_searches enable row level security;
alter table public.prospect_leads    enable row level security;
alter table public.prospect_messages enable row level security;
alter table public.prospect_settings enable row level security;

create policy "prospect_searches: admin" on public.prospect_searches for all using (public.is_admin()) with check (public.is_admin());
create policy "prospect_leads: admin"    on public.prospect_leads    for all using (public.is_admin()) with check (public.is_admin());
create policy "prospect_messages: admin" on public.prospect_messages for all using (public.is_admin()) with check (public.is_admin());
create policy "prospect_settings: admin read"   on public.prospect_settings for select using (public.is_admin());
create policy "prospect_settings: admin update" on public.prospect_settings for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- secrets
-- Secret in the Evolution webhook URL (Evolution → Edge Function "prospect").
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'wa_webhook_secret', 'Evolution API → prospect webhook')
 where not exists (select 1 from vault.secrets where name = 'wa_webhook_secret');

-- Only the Edge Function (service role) reads the prospecting configuration.
create or replace function public.prospect_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
                    where name in ('google_places_key', 'anthropic_api_key', 'evolution_url', 'evolution_api_key',
                                   'evolution_instance', 'notify_secret', 'wa_webhook_secret')), '{}'::jsonb)
      || coalesce((select jsonb_object_agg(key, value) from private.config where key in ('app_url', 'functions_url')), '{}'::jsonb);
$$;
revoke execute on function public.prospect_config() from public, anon, authenticated;
grant execute on function public.prospect_config() to service_role;

-- The admin panel shows which keys are set, never their values.
create or replace function public.prospect_integrations() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then jsonb_build_object(
    'google', exists (select 1 from vault.secrets where name = 'google_places_key'),
    'anthropic', exists (select 1 from vault.secrets where name = 'anthropic_api_key')
  ) end;
$$;
revoke execute on function public.prospect_integrations() from public, anon;
grant execute on function public.prospect_integrations() to authenticated;

-- Admin saves (or removes, with an empty value) the Google Places / Anthropic key.
create or replace function public.prospect_save_key(p_name text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_name not in ('google_places_key', 'anthropic_api_key') then raise exception 'invalid key name'; end if;
  select id into v_id from vault.secrets where name = p_name;
  if coalesce(trim(p_value), '') = '' then
    delete from vault.secrets where id = v_id;
  elsif v_id is null then
    perform vault.create_secret(trim(p_value), p_name);
  else
    perform vault.update_secret(v_id, trim(p_value));
  end if;
end $$;
revoke execute on function public.prospect_save_key(text, text) from public, anon;
grant execute on function public.prospect_save_key(text, text) to authenticated;

-- One tick at a time (pg_cron fires every minute; a slow tick must not overlap the next one).
create or replace function public.prospect_claim_tick() returns boolean
language sql security definer set search_path = '' as $$
  with claimed as (
    update public.prospect_settings set tick_lock_until = now() + interval '50 seconds'
     where id = 1 and (tick_lock_until is null or tick_lock_until < now())
    returning 1
  )
  select exists (select 1 from claimed);
$$;
revoke execute on function public.prospect_claim_tick() from public, anon, authenticated;
grant execute on function public.prospect_claim_tick() to service_role;

-- ---------------------------------------------------------------- scheduler
create or replace function private.prospect_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.prospect_settings where id = 1 and enabled) then return; end if;
  select value into v_url from private.config where key = 'functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url || '/prospect',
    body := jsonb_build_object('action', 'tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 55000
  );
end $$;
revoke execute on function private.prospect_tick() from public, anon, authenticated;

select cron.schedule('prospect-tick', '* * * * *', 'select private.prospect_tick()');
