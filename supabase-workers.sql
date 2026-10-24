-- =====================================================================
-- GOOD GIRLS — WORKER PROFILES + PHOTO/VIDEO GALLERY
-- Run this ONCE in Supabase > SQL Editor > New query > Run.
-- Safe to run again (uses "if not exists" / "on conflict").
-- =====================================================================

-- 1) WORKERS (one row per girl)
create table if not exists public.workers (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  title         text not null default '',
  about         text not null default '',
  tags          text not null default '',
  availability  jsonb not null default '[]'::jsonb,
  button_label  text not null default '',
  button_url    text not null default '',
  extra_label   text not null default '',
  extra_url     text not null default '',
  published     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2) WORKER MEDIA (photos and videos shown in each gallery)
create table if not exists public.worker_media (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references public.workers(id) on delete cascade,
  kind          text not null check (kind in ('image', 'video')),
  url           text not null,
  storage_path  text not null default '',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists worker_media_worker_idx
  on public.worker_media (worker_id, sort_order);

-- 3) SECURITY (Row Level Security)
--    Visitors (anon) can only READ published workers and their media.
--    Logged-in admin (authenticated) can read, add, edit and delete everything.
alter table public.workers      enable row level security;
alter table public.worker_media enable row level security;

drop policy if exists "workers: public read published" on public.workers;
create policy "workers: public read published"
  on public.workers for select to anon
  using (published = true);

drop policy if exists "workers: admin full access" on public.workers;
create policy "workers: admin full access"
  on public.workers for all to authenticated
  using (true) with check (true);

drop policy if exists "worker_media: public read" on public.worker_media;
create policy "worker_media: public read"
  on public.worker_media for select to anon
  using (exists (
    select 1 from public.workers w
    where w.id = worker_media.worker_id and w.published = true
  ));

drop policy if exists "worker_media: admin full access" on public.worker_media;
create policy "worker_media: admin full access"
  on public.worker_media for all to authenticated
  using (true) with check (true);

-- 4) STORAGE BUCKET for photos and videos (public read, 50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'worker-media', 'worker-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "worker-media: public read" on storage.objects;
create policy "worker-media: public read"
  on storage.objects for select
  using (bucket_id = 'worker-media');

drop policy if exists "worker-media: admin upload" on storage.objects;
create policy "worker-media: admin upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'worker-media');

drop policy if exists "worker-media: admin update" on storage.objects;
create policy "worker-media: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'worker-media') with check (bucket_id = 'worker-media');

drop policy if exists "worker-media: admin delete" on storage.objects;
create policy "worker-media: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'worker-media');

-- 5) SEED: move Missy's profile into the new workers table.
--    Uses the text the client already has in the Meet the Girls editor
--    (falls back to the built-in text if a field is missing).
insert into public.workers
  (slug, name, title, about, tags, availability, button_label, button_url, published, sort_order)
select
  'missy',
  coalesce((select value from public.site_content where key = 'meet.t008'), 'Missy'),
  coalesce((select value from public.site_content where key = 'meet.t009'), 'FOUNDER · PRACTITIONER'),
  concat_ws(E'\n\n',
    (select value from public.site_content where key = 'meet.t010'),
    (select value from public.site_content where key = 'meet.t011')),
  concat_ws(', ',
    (select value from public.site_content where key = 'meet.t012'),
    (select value from public.site_content where key = 'meet.t013'),
    (select value from public.site_content where key = 'meet.t014'),
    (select value from public.site_content where key = 'meet.t015')),
  '[]'::jsonb,
  'Request Missy →',
  'booking.html',
  true,
  1
on conflict (slug) do nothing;

-- Missy's first gallery photo (the existing image in the site folder).
insert into public.worker_media (worker_id, kind, url, storage_path, sort_order)
select w.id, 'image', 'images/Missy.jpg', '', 1
from public.workers w
where w.slug = 'missy'
  and not exists (select 1 from public.worker_media m where m.worker_id = w.id);

-- Remove the old single-profile fields from the Meet the Girls editor,
-- because Missy is now managed in "Workers & Profiles".
delete from public.site_content
where page = 'meet'
  and key in ('meet.t008','meet.t009','meet.t010','meet.t011',
              'meet.t012','meet.t013','meet.t014','meet.t015','meet.img007');

-- Done. You should see the workers table, worker_media table and a
-- "worker-media" bucket in Supabase, with Missy listed in workers.
