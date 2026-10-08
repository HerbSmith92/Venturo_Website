-- An activity whose price depends on the item, such as what you paint.

alter table public.listing_activities
  add column if not exists cost_varied boolean not null default false;

comment on column public.listing_activities.cost_varied is
  'The price depends on the item. The directory shows Cost varies instead of a rand amount.';

do $save$
declare
  def text := pg_get_functiondef('private.save_listing_draft(uuid, jsonb)'::regprocedure);
  needle text;
  replacement text;
begin
  if position('v_activity ->> ''cost_varied''' in def) > 0 then
    return;
  end if;

  needle := $n$show_on_from = coalesce((v_activity ->> 'show_on_from')::boolean, false),
          updated_at = now()$n$;
  replacement := $n$show_on_from = coalesce((v_activity ->> 'show_on_from')::boolean, false),
          cost_varied = coalesce((v_activity ->> 'cost_varied')::boolean, false),
          updated_at = now()$n$;
  if position(needle in def) = 0 then
    raise exception 'save_listing_draft activity update was not found';
  end if;
  def := replace(def, needle, replacement);

  needle := $n$show_on_discover, show_on_from
        ) values ($n$;
  replacement := $n$show_on_discover, show_on_from, cost_varied
        ) values ($n$;
  if position(needle in def) = 0 then
    raise exception 'save_listing_draft activity insert columns were not found';
  end if;
  def := replace(def, needle, replacement);

  needle := $n$coalesce((v_activity ->> 'show_on_from')::boolean, false)
        )
        returning id into v_activity_id;$n$;
  replacement := $n$coalesce((v_activity ->> 'show_on_from')::boolean, false),
          coalesce((v_activity ->> 'cost_varied')::boolean, false)
        )
        returning id into v_activity_id;$n$;
  if position(needle in def) = 0 then
    raise exception 'save_listing_draft activity insert values were not found';
  end if;
  def := replace(def, needle, replacement);

  execute def;
end
$save$;
