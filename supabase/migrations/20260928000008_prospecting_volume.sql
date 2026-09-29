-- O número da Elite já está aquecido: limite diário padrão de 50 e máximo de 80 mensagens de prospecção.
alter table public.prospect_settings drop constraint if exists prospect_settings_daily_max_check;
alter table public.prospect_settings add constraint prospect_settings_daily_max_check check (daily_max between 5 and 80);
alter table public.prospect_settings alter column daily_max set default 50;
update public.prospect_settings set daily_max = 50 where id = 1 and daily_max = 30;
