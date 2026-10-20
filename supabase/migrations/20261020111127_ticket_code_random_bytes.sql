-- Ticket codes call gen_random_bytes, which lives in the extensions schema.
-- These functions pin search_path to public, so a paid order never became a ticket.

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'fulfill_event_order',
        'fulfil_event_order',
        'host_issue_comp',
        'host_issue_comp_as_system',
        'accept_event_invite'
      )
  loop
    execute format('alter function %s set search_path = public, extensions', fn);
  end loop;
end $$;
