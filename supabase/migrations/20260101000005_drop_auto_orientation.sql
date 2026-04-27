-- Drop AUTO orientation. Force PORTRAIT or LANDSCAPE choice.
-- Run after the initial schema migration.

-- 1. Update any existing rows
update job_files set orientation = 'PORTRAIT' where orientation = 'AUTO';

-- 2. Replace check constraint
alter table job_files drop constraint if exists job_files_orientation_check;
alter table job_files
  add constraint job_files_orientation_check
  check (orientation in ('PORTRAIT','LANDSCAPE'));

-- 3. New default
alter table job_files alter column orientation set default 'PORTRAIT';
