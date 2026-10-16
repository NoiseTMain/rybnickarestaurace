-- =====================================================================
-- Supabase Storage – úložiště souborů
--   menus  … PNG denního menu (max 15 MB, jen image/png)
--   media  … fotografie, logo, úvodní foto (max 10 MB)
-- Oba buckety jsou veřejné pro čtení (obrázky se zobrazují na webu),
-- nahrávat, přepisovat a mazat smí pouze administrátor.
-- Názvy souborů obsahují náhodné UUID, takže je nelze uhodnout.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menus', 'menus', true, 15728640, array['image/png']),
  ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "menus: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'menus' and public.is_admin());

create policy "menus: admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and public.is_admin()
    and lower(storage.extension(name)) = 'png'
  );

create policy "menus: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'menus' and public.is_admin())
  with check (bucket_id = 'menus' and public.is_admin());

create policy "menus: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menus' and public.is_admin());

create policy "media: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.is_admin());

create policy "media: admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_admin()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'avif', 'svg')
  );

create policy "media: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

create policy "media: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
