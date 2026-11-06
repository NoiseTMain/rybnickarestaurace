-- HomeOS – soukromé úložiště dokumentů (faktury, účtenky, smlouvy)
-- Cesta souboru: {household_id}/{uuid}-{název}. Přístup jen pro členy domácnosti.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'text/csv', 'text/plain']
)
on conflict (id) do nothing;

create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_household_member(((storage.foldername(name))[1])::uuid));
