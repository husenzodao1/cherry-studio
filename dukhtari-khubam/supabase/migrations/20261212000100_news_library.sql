-- News on the home screen (the "Words of the day" block turns into "News") and the schools' Library: books on
-- shelves by category, each with its cover and its file. Both are written by the staff in the panel (pictures,
-- covers and books in the public 'media' bucket) and read by everyone.

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 8000),
  image_path text check (char_length(image_path) <= 500),
  -- one language, or all of them (null)
  locale text check (locale in ('tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs')),
  audience text not null default 'all' check (audience in ('all', 'girls', 'boys')),
  published_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index news_published on public.news (published_at desc);
alter table public.news enable row level security;
create policy news_read on public.news for select to anon, authenticated using (published_at <= now() or private.is_staff());
create policy news_write on public.news for insert to authenticated with check (private.can_create_content());
create policy news_edit on public.news for update to authenticated using (private.can_create_content()) with check (private.can_create_content());
create policy news_remove on public.news for delete to authenticated using (private.can_create_content());
grant select on public.news to anon, authenticated;
grant insert, update, delete on public.news to authenticated;

create table public.library_shelves (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  emoji text check (char_length(emoji) <= 16),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references public.library_shelves (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text check (char_length(author) <= 200),
  about text check (char_length(about) <= 4000),
  cover_path text check (char_length(cover_path) <= 500),
  file_path text check (char_length(file_path) <= 500),
  pages integer check (pages between 1 and 100000),
  locale text check (locale in ('tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs')),
  audience text not null default 'all' check (audience in ('all', 'girls', 'boys')),
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index library_books_shelf on public.library_books (shelf_id, position);
alter table public.library_shelves enable row level security;
alter table public.library_books enable row level security;
create policy library_shelves_read on public.library_shelves for select to anon, authenticated using (true);
create policy library_shelves_write on public.library_shelves for all to authenticated using (private.can_create_content()) with check (private.can_create_content());
create policy library_books_read on public.library_books for select to anon, authenticated using (published or private.is_staff());
create policy library_books_write on public.library_books for all to authenticated using (private.can_create_content()) with check (private.can_create_content());
grant select on public.library_shelves, public.library_books to anon, authenticated;
grant insert, update, delete on public.library_shelves, public.library_books to authenticated;
