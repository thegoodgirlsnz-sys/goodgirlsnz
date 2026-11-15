-- =====================================================================
-- GOOD GIRLS — BLOG (posts table + media storage)
-- Run this ONCE in Supabase > SQL Editor > New query > Run.
-- Safe to run again.
-- =====================================================================

-- 1) BLOG POSTS
create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null default '',
  excerpt       text not null default '',
  cover_url     text not null default '',
  cover_path    text not null default '',
  body_html     text not null default '',
  status        text not null default 'draft' check (status in ('draft', 'published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists blog_posts_status_idx
  on public.blog_posts (status, published_at desc);

-- 2) SECURITY (Row Level Security)
--    Visitors (anon) can only READ published posts.
--    Logged-in admin (authenticated) can read, add, edit and delete everything.
alter table public.blog_posts enable row level security;

drop policy if exists "blog_posts: public read published" on public.blog_posts;
create policy "blog_posts: public read published"
  on public.blog_posts for select to anon
  using (status = 'published');

drop policy if exists "blog_posts: admin full access" on public.blog_posts;
create policy "blog_posts: admin full access"
  on public.blog_posts for all to authenticated
  using (true) with check (true);

-- 3) STORAGE BUCKET for blog images and videos (public read, 50 MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-media', 'blog-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: admin can upload/delete in this bucket (public read is via the public bucket URL)
drop policy if exists "blog-media: admin upload" on storage.objects;
create policy "blog-media: admin upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'blog-media');

drop policy if exists "blog-media: admin delete" on storage.objects;
create policy "blog-media: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'blog-media');
