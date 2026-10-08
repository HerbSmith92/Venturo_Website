-- A cost with no sub activity name belongs to the activity. Do not drop it.

do $fix$
declare
  def text := pg_get_functiondef('private.save_listing_draft(uuid, jsonb)'::regprocedure);
  needle text := $n$          if coalesce(btrim(v_price ->> 'name'), '') = '' then
            continue;
          end if;$n$;
  replacement text := $n$          if coalesce(btrim(v_price ->> 'name'), '') = '' then
            if nullif(btrim(coalesce(v_price ->> 'standard_price', '')), '') is null
               and nullif(btrim(coalesce(v_price ->> 'member_price', '')), '') is null
            then
              continue;
            end if;
            v_price := jsonb_set(
              v_price,
              '{name}',
              to_jsonb(coalesce(nullif(btrim(coalesce(v_activity ->> 'name', '')), ''), 'Price'))
            );
          end if;$n$;
begin
  if position(needle in def) = 0 then
    return;
  end if;
  execute replace(def, needle, replacement);
end
$fix$;
