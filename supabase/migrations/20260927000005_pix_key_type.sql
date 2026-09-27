-- Pix keys are stored in DICT format with their type (phone keys need +55).
alter table public.settings
  add column if not exists pix_key_type text not null default 'phone'
  check (pix_key_type in ('cpf', 'cnpj', 'phone', 'email', 'evp'));

-- The key saved so far was a phone number without the country code.
update public.settings
   set pix_key = '+55' || regexp_replace(pix_key, '\D', '', 'g'), pix_key_type = 'phone'
 where id = 1 and pix_key ~ '^\d{10,11}$';
