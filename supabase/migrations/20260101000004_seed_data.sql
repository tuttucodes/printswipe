-- =============================================================================
-- Seed: campuses + shops (idempotent).
-- Run in Supabase SQL editor (or via supabase db push).
-- Merchants + demo students are created via the Auth API — use scripts/seed.ts
-- locally for those (they need auth.admin.createUser).
-- =============================================================================

-- Campuses (4)
insert into campuses (name, city, allowed_email_domains, timezone, is_active) values
  ('VIT Chennai',  'Chennai', array['vit.ac.in','vitstudent.ac.in'],                              'Asia/Kolkata', true),
  ('VIT Vellore',  'Vellore', array['vit.ac.in','vitstudent.ac.in'],                              'Asia/Kolkata', true),
  ('IIT Madras',   'Chennai', array['smail.iitm.ac.in','iitm.ac.in'],                             'Asia/Kolkata', true),
  ('BITS Pilani',  'Pilani',  array['pilani.bits-pilani.ac.in','hyderabad.bits-pilani.ac.in'],     'Asia/Kolkata', true)
on conflict (name) do update set
  city = excluded.city,
  allowed_email_domains = excluded.allowed_email_domains,
  timezone = excluded.timezone,
  is_active = excluded.is_active;

-- Default pricing JSON (paise per side / per sheet)
do $$
declare
  v_pricing jsonb := '{
    "plain": {"bw": {"A4": 200, "A3": 400}, "color": {"A4": 1000, "A3": 2000}},
    "poster_glossy": {"color": {"A4": 5000, "A2": 25000}, "bw": {"A4": 4000, "A2": 20000}},
    "duplex_discount_percent": 15,
    "currency": "INR"
  }'::jsonb;
  v_printers jsonb := '{
    "printers": [
      {"id":"p1","label":"HP LaserJet Pro M283","supports_color":false,"supported_paper_types":["PLAIN"],"supported_paper_sizes":["A4","A3"],"supports_duplex":true},
      {"id":"p2","label":"Canon ImageRunner C3226i","supports_color":true,"supported_paper_types":["PLAIN"],"supported_paper_sizes":["A4","A3"],"supports_duplex":true},
      {"id":"p3","label":"Epson SureColor P700","supports_color":true,"supported_paper_types":["POSTER_GLOSSY"],"supported_paper_sizes":["A4"],"supports_duplex":false},
      {"id":"p4","label":"Epson SureColor T3170M","supports_color":true,"supported_paper_types":["POSTER_GLOSSY"],"supported_paper_sizes":["A2"],"supports_duplex":false}
    ],
    "stream_routing": {"bw_a4":"p1","bw_a3":"p1","color_a4":"p2","color_a3":"p2","poster_a4":"p3","poster_a2":"p4"}
  }'::jsonb;
  v_hours jsonb := '{
    "mon":{"open":"09:00","close":"21:00"},
    "tue":{"open":"09:00","close":"21:00"},
    "wed":{"open":"09:00","close":"21:00"},
    "thu":{"open":"09:00","close":"21:00"},
    "fri":{"open":"09:00","close":"21:00"},
    "sat":{"open":"09:00","close":"21:00"},
    "sun":{"closed":true}
  }'::jsonb;
  v_vit_chennai uuid;
  v_vit_vellore uuid;
  v_iit uuid;
  v_bits uuid;
begin
  select id into v_vit_chennai from campuses where name = 'VIT Chennai';
  select id into v_vit_vellore from campuses where name = 'VIT Vellore';
  select id into v_iit          from campuses where name = 'IIT Madras';
  select id into v_bits         from campuses where name = 'BITS Pilani';

  -- VIT Chennai shops (4)
  insert into shops (campus_id, name, location_desc, hours_json, slot_duration_min, max_per_slot, bin_count, pricing_json, printer_config_json, premium_percent, gst_enabled, is_active)
  select v_vit_chennai, n.name, n.loc, v_hours, 15, 8, 10, v_pricing, v_printers, 25, false, true
  from (values
    ('Block A Prints', 'Block A ground floor, near food court'),
    ('Block B Prints', 'Block B ground floor, near library'),
    ('Block C Prints', 'Block C ground floor, near cafeteria'),
    ('Block D Prints', 'Block D ground floor, near auditorium')
  ) as n(name, loc)
  where not exists (
    select 1 from shops s where s.campus_id = v_vit_chennai and s.name = n.name
  );

  -- One shop per other campus
  insert into shops (campus_id, name, location_desc, hours_json, slot_duration_min, max_per_slot, bin_count, pricing_json, printer_config_json, premium_percent, gst_enabled, is_active)
  select c.id, c.name || ' Central Prints', 'Main academic block, ground floor', v_hours, 15, 8, 10, v_pricing, v_printers, 25, false, true
  from (values (v_vit_vellore, 'VIT Vellore'), (v_iit, 'IIT Madras'), (v_bits, 'BITS Pilani')) as c(id, name)
  where c.id is not null
    and not exists (select 1 from shops s where s.campus_id = c.id and s.name = c.name || ' Central Prints');
end $$;

-- Verify
select c.name as campus, count(s.id) as shops
from campuses c
left join shops s on s.campus_id = c.id and s.is_active = true
group by c.name
order by c.name;
