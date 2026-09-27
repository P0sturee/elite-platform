-- Delivery moves into the "platform" Edge Function. Third-party secrets live in Supabase Vault
-- (resend_api_key, email_from, evolution_url, evolution_api_key, evolution_instance, notify_secret)
-- and are set outside of migrations so they never reach git.

-- Only the Edge Function (service role) can read the delivery configuration.
create or replace function public.delivery_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
                    where name in ('resend_api_key', 'email_from', 'evolution_url', 'evolution_api_key',
                                   'evolution_instance', 'notify_secret')), '{}'::jsonb)
      || coalesce((select jsonb_object_agg(key, value) from private.config where key in ('app_url')), '{}'::jsonb);
$$;
revoke execute on function public.delivery_config() from public, anon, authenticated;
grant execute on function public.delivery_config() to service_role;

-- Auth e-mails (confirmation, password reset): at most 3 per address per hour and 100 per hour overall.
create table if not exists private.mail_log (
  id         bigserial primary key,
  email      text not null,
  kind       text not null,
  created_at timestamptz not null default now()
);
create index if not exists mail_log_email_idx on private.mail_log (email, created_at desc);

create or replace function public.auth_mail_allowed(p_email text, p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from private.mail_log where email = lower(p_email) and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.mail_log where created_at > now() - interval '1 hour') >= 100 then
    return false;
  end if;
  insert into private.mail_log (email, kind) values (lower(p_email), p_kind);
  return true;
end $$;
revoke execute on function public.auth_mail_allowed(text, text) from public, anon, authenticated;
grant execute on function public.auth_mail_allowed(text, text) to service_role;

-- New notifications go to the Edge Function (same region as the database).
create or replace function private.dispatch_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.config where key = 'functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url || '/platform',
    body := jsonb_build_object('action', 'notify', 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret)
  );
  return new;
end $$;

delete from private.config where key = 'notify_secret';

-- A WhatsApp number given at signup means the client wants WhatsApp notices.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adm boolean;
  v_phone text := coalesce(new.raw_user_meta_data ->> 'phone', '');
begin
  select exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) into adm;
  insert into public.profiles (id, email, full_name, company, phone, role, status, notify_whatsapp)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', ''),
    v_phone,
    case when adm then 'admin'::public.user_role else 'client'::public.user_role end,
    case when adm then 'active'::public.account_status else 'pending'::public.account_status end,
    length(regexp_replace(v_phone, '\D', '', 'g')) >= 10
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
