-- Saving an approved or in-review listing sends it back to draft
-- so the editor's next step is Submit for Approval.

do $save$
declare
  def text := pg_get_functiondef('private.save_listing_draft(uuid, jsonb)'::regprocedure);
  needle text := E'terms_accepted = coalesce((p_payload ->> ''terms_accepted'')::boolean, terms_accepted),\n    updated_at = now()';
  replacement text := E'terms_accepted = coalesce((p_payload ->> ''terms_accepted'')::boolean, terms_accepted),\n    status = case\n      when status in (''approved'', ''review'') then ''draft''::public.directory_status\n      else status\n    end,\n    updated_at = now()';
begin
  if position('when status in (''approved'', ''review'')' in def) = 0 then
    if position(needle in def) = 0 then
      raise exception 'save_listing_draft status patch point was not found';
    end if;
    execute replace(def, needle, replacement);
  end if;
end
$save$;
