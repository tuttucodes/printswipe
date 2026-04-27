-- RLS policies. Public reads on shops/campuses; users own jobs/files.

-- profiles
alter table profiles enable row level security;
drop policy if exists "profiles_self_read" on profiles;
drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_read" on profiles for select
  using (auth.uid() = id);
create policy "profiles_self_update" on profiles for update
  using (auth.uid() = id);

-- jobs
alter table jobs enable row level security;
drop policy if exists "jobs_student_own" on jobs;
drop policy if exists "jobs_merchant_shop" on jobs;
drop policy if exists "jobs_merchant_update" on jobs;
create policy "jobs_student_own" on jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "jobs_merchant_shop" on jobs for select
  using (shop_id in (select shop_id from merchants where profile_id = auth.uid()));
create policy "jobs_merchant_update" on jobs for update
  using (shop_id in (select shop_id from merchants where profile_id = auth.uid()));

-- job_files
alter table job_files enable row level security;
drop policy if exists "files_student_own" on job_files;
drop policy if exists "files_merchant_shop" on job_files;
create policy "files_student_own" on job_files for all
  using (job_id in (select id from jobs where user_id = auth.uid()))
  with check (job_id in (select id from jobs where user_id = auth.uid()));
create policy "files_merchant_shop" on job_files for select
  using (job_id in (
    select id from jobs where shop_id in (
      select shop_id from merchants where profile_id = auth.uid()
    )
  ));

-- shops, campuses public read
alter table shops enable row level security;
drop policy if exists "shops_public_read" on shops;
create policy "shops_public_read" on shops for select using (is_active = true);

alter table campuses enable row level security;
drop policy if exists "campuses_public_read" on campuses;
create policy "campuses_public_read" on campuses for select using (is_active = true);

-- merchants self-read
alter table merchants enable row level security;
drop policy if exists "merchants_self" on merchants;
create policy "merchants_self" on merchants for select
  using (profile_id = auth.uid());

-- print_batches: merchants for their shop
alter table print_batches enable row level security;
drop policy if exists "batches_merchant" on print_batches;
create policy "batches_merchant" on print_batches for all
  using (shop_id in (select shop_id from merchants where profile_id = auth.uid()))
  with check (shop_id in (select shop_id from merchants where profile_id = auth.uid()));

-- slot_blocks: merchants for their shop; public read
alter table slot_blocks enable row level security;
drop policy if exists "blocks_merchant" on slot_blocks;
drop policy if exists "blocks_public_read" on slot_blocks;
create policy "blocks_merchant" on slot_blocks for all
  using (shop_id in (select shop_id from merchants where profile_id = auth.uid()))
  with check (shop_id in (select shop_id from merchants where profile_id = auth.uid()));
create policy "blocks_public_read" on slot_blocks for select using (true);

-- payment_audit
alter table payment_audit enable row level security;
drop policy if exists "audit_student_own" on payment_audit;
create policy "audit_student_own" on payment_audit for select
  using (job_id in (select id from jobs where user_id = auth.uid()));

-- app_settings: public read
alter table app_settings enable row level security;
drop policy if exists "app_settings_public_read" on app_settings;
create policy "app_settings_public_read" on app_settings for select using (true);

-- token_counters: server-only (no RLS policies = nothing accessible to anon)
alter table token_counters enable row level security;
