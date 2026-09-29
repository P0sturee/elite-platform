-- Fonte das empresas: OpenStreetMap (grátis, sem chave) ou Google Places (precisa de faturamento no Google Cloud).
alter table public.prospect_settings
  add column if not exists lead_source text not null default 'osm' check (lead_source in ('osm', 'google'));
