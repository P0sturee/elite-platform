-- Adds email_from_fallback (used while the main sender's domain is not verified in Resend).
create or replace function public.delivery_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
                    where name in ('resend_api_key', 'email_from', 'email_from_fallback', 'evolution_url',
                                   'evolution_api_key', 'evolution_instance', 'notify_secret')), '{}'::jsonb)
      || coalesce((select jsonb_object_agg(key, value) from private.config where key in ('app_url')), '{}'::jsonb);
$$;
revoke execute on function public.delivery_config() from public, anon, authenticated;
grant execute on function public.delivery_config() to service_role;
