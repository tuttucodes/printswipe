-- Storage buckets + RLS. Run in Supabase SQL editor (storage schema needs sufficient privileges).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-files', 'job-files', false, 52428800,
   array['application/pdf','image/jpeg','image/png','image/heic','image/heif']),
  ('print-batches', 'print-batches', false, 209715200, array['application/pdf']),
  ('receipts', 'receipts', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- job-files: user reads/writes own folder; merchants read shop's job folders.
drop policy if exists "job_files_owner_rw" on storage.objects;
create policy "job_files_owner_rw" on storage.objects for all to authenticated
  using (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'job-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "job_files_merchant_read" on storage.objects;
create policy "job_files_merchant_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'job-files'
    and exists (
      select 1 from public.jobs j
      join public.merchants m on m.shop_id = j.shop_id
      where m.profile_id = auth.uid()
        and j.id::text = (storage.foldername(name))[2]
    )
  );

-- print-batches: merchants read their shop folders only.
drop policy if exists "print_batches_merchant_read" on storage.objects;
create policy "print_batches_merchant_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'print-batches'
    and exists (
      select 1 from public.merchants m
      where m.profile_id = auth.uid()
        and m.shop_id::text = (storage.foldername(name))[1]
    )
  );

-- receipts: user reads own folder.
drop policy if exists "receipts_owner_read" on storage.objects;
create policy "receipts_owner_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
