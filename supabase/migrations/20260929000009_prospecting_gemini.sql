-- A IA da prospecção passa a usar o Gemini (Google AI Studio, cota gratuita) quando a chave existir;
-- a Anthropic continua como opção.
create or replace function public.prospect_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
                    where name in ('google_places_key', 'gemini_api_key', 'anthropic_api_key', 'evolution_url', 'evolution_api_key',
                                   'evolution_instance', 'notify_secret', 'wa_webhook_secret')), '{}'::jsonb)
      || coalesce((select jsonb_object_agg(key, value) from private.config where key in ('app_url', 'functions_url')), '{}'::jsonb);
$$;
revoke execute on function public.prospect_config() from public, anon, authenticated;
grant execute on function public.prospect_config() to service_role;

create or replace function public.prospect_integrations() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then jsonb_build_object(
    'google', exists (select 1 from vault.secrets where name = 'google_places_key'),
    'gemini', exists (select 1 from vault.secrets where name = 'gemini_api_key'),
    'anthropic', exists (select 1 from vault.secrets where name = 'anthropic_api_key')
  ) end;
$$;
revoke execute on function public.prospect_integrations() from public, anon;
grant execute on function public.prospect_integrations() to authenticated;

create or replace function public.prospect_save_key(p_name text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_name not in ('google_places_key', 'gemini_api_key', 'anthropic_api_key') then raise exception 'invalid key name'; end if;
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
