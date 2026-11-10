-- City of referees / table officials, and what each table official can do.
-- Both are editable by the person (own profile) and by admins.
alter table public.profiles
  add column city text,
  add column table_skills text[] not null default '{}';

alter table public.profiles add constraint profiles_table_skills_valid
  check (table_skills <@ array['dss', 'scorer', 'timekeeper', 'shot_clock', 'statistics']::text[]);

-- Public names view (no contact data) gains city and skills, used for nominations and lists.
create or replace view public.profile_names as
  select id, full_name, region, is_referee, is_table_official, city, table_skills
    from public.profiles;
revoke all on public.profile_names from anon;
grant select on public.profile_names to authenticated;
