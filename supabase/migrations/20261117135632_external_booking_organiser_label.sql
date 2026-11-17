-- Third-party external booking: public organiser name & Book now label.
-- organiser_id remains the Venturo account that owns the draft (often an admin).

alter table public.events
  add column if not exists organiser_display_name text,
  add column if not exists external_booking_button_label text;

alter table public.events
  drop constraint if exists events_external_booking_fields_check;

alter table public.events
  add constraint events_external_booking_fields_check check (
    (booking_method <> 'external')
    or (
      nullif(btrim(external_provider_name), '') is not null
      and external_booking_url ~* '^https://'
    )
  );

create or replace function public.set_event_booking_method(
  p_event_id uuid,
  p_method text,
  p_provider_name text default null,
  p_external_url text default null,
  p_waitlist_enabled boolean default false,
  p_button_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_has_admissions boolean;
  v_label text;
begin
  if auth.uid() is null or not public.can_manage_event(p_event_id) then
    raise exception 'not allowed';
  end if;
  if p_method not in ('free_rsvp', 'venturo_ticketing', 'external') then
    raise exception 'invalid booking method';
  end if;
  if p_method = 'external' and (
    nullif(btrim(p_provider_name), '') is null
    or p_external_url !~* '^https://'
  ) then
    raise exception 'External booking needs a provider and HTTPS URL.';
  end if;

  select booking_method into v_current from public.events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  select exists (
    select 1 from public.event_tickets where event_id = p_event_id
  ) into v_has_admissions;
  if v_current <> p_method and v_has_admissions then
    raise exception 'Booking method is locked after the first admission. Use the audited admin migration flow.';
  end if;

  v_label := nullif(btrim(coalesce(p_button_label, '')), '');
  if p_method = 'external' and v_label is null then
    v_label := 'Book now';
  end if;

  update public.events
  set booking_method = p_method,
      external_provider_name = case when p_method = 'external' then nullif(btrim(p_provider_name), '') else null end,
      external_booking_url = case when p_method = 'external' then p_external_url else null end,
      external_booking_button_label = case when p_method = 'external' then v_label else null end,
      external_booking_verified_at = case when p_method = 'external' and public.is_staff() then now() else null end,
      waitlist_enabled = case when p_method <> 'external' then p_waitlist_enabled else false end,
      updated_at = now()
  where id = p_event_id;

  insert into public.event_audit_events (event_id, actor_id, action, before, after)
  values (
    p_event_id,
    auth.uid(),
    'booking_method_changed',
    jsonb_build_object('booking_method', v_current),
    jsonb_build_object(
      'booking_method', p_method,
      'provider', p_provider_name,
      'button_label', v_label
    )
  );
end;
$$;
