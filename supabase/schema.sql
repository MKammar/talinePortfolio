create table if not exists public.portfolio_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_drafts (
  id boolean primary key default true check (id),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_site (
  id boolean primary key default true check (id),
  content jsonb not null,
  published_at timestamptz not null default now()
);

create or replace function public.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portfolio_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_portfolio_admin() from public;
grant execute on function public.is_portfolio_admin() to authenticated;

alter table public.portfolio_admins enable row level security;
alter table public.portfolio_drafts enable row level security;
alter table public.portfolio_site enable row level security;

drop policy if exists "Admins manage portfolio admins" on public.portfolio_admins;
create policy "Admins manage portfolio admins"
  on public.portfolio_admins for all to authenticated
  using (public.is_portfolio_admin())
  with check (public.is_portfolio_admin());

drop policy if exists "Admins manage portfolio drafts" on public.portfolio_drafts;
create policy "Admins manage portfolio drafts"
  on public.portfolio_drafts for all to authenticated
  using (public.is_portfolio_admin())
  with check (public.is_portfolio_admin());

drop policy if exists "Anyone can read the published portfolio" on public.portfolio_site;
create policy "Anyone can read the published portfolio"
  on public.portfolio_site for select to anon, authenticated
  using (true);

drop policy if exists "Admins publish the portfolio" on public.portfolio_site;
create policy "Admins publish the portfolio"
  on public.portfolio_site for all to authenticated
  using (public.is_portfolio_admin())
  with check (public.is_portfolio_admin());

grant select, insert, update, delete on public.portfolio_admins to authenticated;
grant select, insert, update, delete on public.portfolio_drafts to authenticated;
grant select, insert, update, delete on public.portfolio_site to authenticated;
grant select on public.portfolio_site to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-media',
  'portfolio-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view portfolio media" on storage.objects;
create policy "Anyone can view portfolio media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio-media');

drop policy if exists "Admins upload portfolio media" on storage.objects;
create policy "Admins upload portfolio media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-media' and public.is_portfolio_admin());

drop policy if exists "Admins update portfolio media" on storage.objects;
create policy "Admins update portfolio media"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-media' and public.is_portfolio_admin())
  with check (bucket_id = 'portfolio-media' and public.is_portfolio_admin());

drop policy if exists "Admins delete portfolio media" on storage.objects;
create policy "Admins delete portfolio media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-media' and public.is_portfolio_admin());
