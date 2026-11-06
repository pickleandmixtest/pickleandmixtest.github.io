-- Pickle&Mix bilingual preference (Spanish / English)
-- Idempotent so it can also be applied to the TEST project where the column
-- was initially added while preparing the feature.
alter table public.profiles
  add column if not exists preferred_language text not null default 'es'
  check (preferred_language in ('es', 'en'));

grant update (preferred_language)
  on table public.profiles
  to authenticated;
