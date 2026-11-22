-- Духтари хубам · 0007 storage buckets, privilege hardening, scheduler

-- ---------------------------------------------------------------- storage
-- 'media' is public (CDN-cached delivery of published assets);
-- 'media-protected' serves premium files through short-lived signed URLs.
-- SVG is not accepted: uploaded SVG can carry script. Bundled UI icons live in the app code.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 52428800, array[
    'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/ktx2',
    'video/mp4', 'video/webm', 'application/vnd.apple.mpegurl', 'application/x-mpegurl', 'video/mp2t',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm',
    'application/pdf', 'model/gltf-binary', 'model/gltf+json', 'text/vtt']),
  ('media-protected', 'media-protected', false, 52428800, array[
    'image/png', 'image/jpeg', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm', 'application/vnd.apple.mpegurl', 'application/x-mpegurl', 'video/mp2t',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm',
    'application/pdf', 'model/gltf-binary', 'text/vtt'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "dk media staff upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('media', 'media-protected') and private.can_manage_media());
create policy "dk media staff update" on storage.objects for update to authenticated
  using (bucket_id in ('media', 'media-protected') and private.can_manage_media())
  with check (bucket_id in ('media', 'media-protected') and private.can_manage_media());
create policy "dk media staff delete unused" on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'media-protected')
         and private.has_any_role(array['content_admin', 'media_manager']::public.app_role[])
         and not exists (select 1 from public.media_assets a where a.bucket = bucket_id and a.path = name)
         and not exists (select 1 from public.media_asset_versions v where v.bucket = bucket_id and v.path = name));
create policy "dk media staff list" on storage.objects for select to authenticated
  using (bucket_id in ('media', 'media-protected') and private.is_staff());
create policy "dk protected entitled read" on storage.objects for select to authenticated
  using (bucket_id = 'media-protected' and private.has_premium((select auth.uid())));

-- ---------------------------------------------------------------- privileges
-- Internal helpers are not callable by clients, except those RLS policies evaluate as the caller.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.has_role(public.app_role), private.has_any_role(public.app_role[]), private.is_staff(),
  private.is_super_admin(), private.can_edit_any(), private.can_edit_owned(uuid), private.can_create_content(),
  private.can_review(), private.can_publish(), private.can_manage_media(), private.can_view_analytics(),
  private.has_premium(uuid), private.fail(text, jsonb), private.is_live_status(public.content_status, timestamptz),
  private.school_live(uuid), private.course_live(uuid), private.module_live(uuid), private.topic_live(uuid),
  private.lesson_live(uuid), private.quiz_live(uuid),
  private.can_edit_course(uuid), private.can_edit_module(uuid), private.can_edit_topic(uuid),
  private.can_edit_lesson(uuid), private.can_edit_block(uuid), private.can_edit_quiz(uuid),
  private.can_edit_question(uuid), private.can_edit_option(uuid), private.can_edit_section(uuid)
to anon, authenticated;

-- Staff RPCs are not callable anonymously (they also check roles inside).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------- scheduler (pg_cron when available)
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available: %', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dk-run-scheduled', '* * * * *', 'select private.run_scheduled()');
  end if;
end $$;
