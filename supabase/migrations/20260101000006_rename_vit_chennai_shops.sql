-- Rename VIT Chennai shops to real on-campus print stations.
-- Idempotent: matches the seeded "Block X Prints" names; no-op if already renamed.

do $$
declare
  v_campus uuid;
begin
  select id into v_campus from campuses where name = 'VIT Chennai' limit 1;
  if v_campus is null then
    raise notice 'VIT Chennai campus not found; nothing to rename.';
    return;
  end if;

  update shops
    set name = 'MSP Xerox AB1 Ground Floor',
        location_desc = 'AB1 Building · Ground Floor · Near main entrance'
    where campus_id = v_campus and name = 'Block A Prints';

  update shops
    set name = 'MSP Xerox AB1 6th Floor',
        location_desc = 'AB1 Building · 6th Floor · Near department offices'
    where campus_id = v_campus and name = 'Block B Prints';

  update shops
    set name = 'MSP Xerox Library',
        location_desc = 'Central Library · Ground Floor · Inside reading hall'
    where campus_id = v_campus and name = 'Block C Prints';

  update shops
    set name = 'Bethseda AB3 Basement',
        location_desc = 'AB3 Building · Basement · Near canteen'
    where campus_id = v_campus and name = 'Block D Prints';
end $$;

-- Verify
select name, location_desc from shops
where campus_id = (select id from campuses where name = 'VIT Chennai')
order by name;
