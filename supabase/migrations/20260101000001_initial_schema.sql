-- Printswipe initial schema. All amounts paise (int). All timestamps UTC.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================================
-- Campuses
-- =========================================================================
create table if not exists campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null,
  allowed_email_domains text[] not null,
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Shops
-- =========================================================================
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  location_desc text,
  lat numeric(9,6),
  lng numeric(9,6),
  hours_json jsonb not null,
  slot_duration_min int not null default 15,
  max_per_slot int not null default 8,
  bin_count int not null default 10,
  pricing_json jsonb not null,
  printer_config_json jsonb not null,
  premium_percent numeric(5,2) not null default 25,
  gst_enabled boolean not null default false,
  gst_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_shops_campus on shops(campus_id);

-- =========================================================================
-- Profiles
-- =========================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  campus_id uuid references campuses(id),
  name text,
  phone text,
  role text not null default 'student' check (role in ('student','merchant','admin')),
  notification_sms boolean not null default true,
  notification_email boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Merchants
-- =========================================================================
create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  unique(profile_id, shop_id)
);
create index if not exists idx_merchants_shop on merchants(shop_id);

-- =========================================================================
-- Token counters
-- =========================================================================
create table if not exists token_counters (
  shop_id uuid not null,
  date date not null,
  next_number int not null default 1,
  primary key (shop_id, date)
);

-- =========================================================================
-- Jobs
-- =========================================================================
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  shop_id uuid not null references shops(id),
  token text,
  slot_time timestamptz not null,
  status text not null default 'PENDING_PAYMENT' check (status in
    ('PENDING_PAYMENT','SCHEDULED','BUNDLED','PRINTED','READY','COLLECTED','EXPIRED','FAILED','REFUNDED')),
  bin_number int,
  total_pages_color int not null default 0,
  total_pages_bw int not null default 0,
  total_pages_poster int not null default 0,
  total_amount_paise int not null,
  premium_amount_paise int not null default 0,
  gst_amount_paise int not null default 0,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  batch_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  collected_at timestamptz
);
create index if not exists idx_jobs_shop_slot on jobs(shop_id, slot_time);
create index if not exists idx_jobs_user on jobs(user_id, created_at desc);
create unique index if not exists idx_jobs_token on jobs(shop_id, token) where token is not null;

-- =========================================================================
-- Job files
-- =========================================================================
create table if not exists job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  page_count int not null,
  paper_type text not null check (paper_type in ('PLAIN','POSTER_GLOSSY')),
  paper_size text not null check (paper_size in ('A4','A3','A2')),
  color_mode text not null check (color_mode in ('ALL_COLOR','ALL_BW','MIXED')),
  color_pages_spec text,
  sides text not null check (sides in ('SINGLE','DOUBLE')),
  layout int not null default 1 check (layout in (1,2,4,6)),
  copies int not null default 1 check (copies between 1 and 50),
  page_range_spec text,
  orientation text not null default 'AUTO' check (orientation in ('AUTO','PORTRAIT','LANDSCAPE')),
  settings_json jsonb not null,
  order_index int not null default 0,
  deleted_at timestamptz,
  -- Cross-field validity (paper-type matrix per spec §5)
  constraint paper_size_valid check (
    (paper_type = 'PLAIN' and paper_size in ('A4','A3'))
    or (paper_type = 'POSTER_GLOSSY' and paper_size in ('A4','A2'))
  ),
  constraint poster_constraints check (
    paper_type = 'PLAIN' or (sides = 'SINGLE' and layout = 1)
  )
);
create index if not exists idx_files_job on job_files(job_id);

-- =========================================================================
-- Print batches
-- =========================================================================
create table if not exists print_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  merchant_id uuid references merchants(id),
  job_ids uuid[] not null,
  manifest_json jsonb not null,
  streams_json jsonb not null,
  created_at timestamptz not null default now(),
  printed_at timestamptz,
  notes text
);
create index if not exists idx_batches_shop on print_batches(shop_id, created_at desc);

-- =========================================================================
-- Slot blocks
-- =========================================================================
create table if not exists slot_blocks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  slot_time timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(shop_id, slot_time)
);

-- =========================================================================
-- Payment audit
-- =========================================================================
create table if not exists payment_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  event_type text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_audit_job on payment_audit(job_id, created_at desc);

-- =========================================================================
-- App settings
-- =========================================================================
create table if not exists app_settings (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed defaults (idempotent)
insert into app_settings (key, value_json) values
  ('file_ttl_minutes_after_collected', '30'::jsonb),
  ('file_ttl_minutes_after_slot',       '240'::jsonb),
  ('default_premium_percent',           '25'::jsonb),
  ('gst_percent',                       '18'::jsonb),
  ('refund_admin_fee_percent',          '10'::jsonb),
  ('token_letter_rotation',             '"monthly"'::jsonb),
  ('max_days_ahead_for_booking',        '3'::jsonb)
on conflict (key) do nothing;

-- =========================================================================
-- handle_new_user trigger
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- next_token RPC: atomic token assignment
-- =========================================================================
create or replace function public.next_token(p_shop_id uuid, p_local_date date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  insert into token_counters (shop_id, date, next_number)
  values (p_shop_id, p_local_date, 1)
  on conflict (shop_id, date) do update
    set next_number = token_counters.next_number + 1
  returning next_number into v_n;
  return v_n;
end;
$$;
