-- Relatable onboarding copy. Keys stay stable for CSS classes & foreign keys.
-- Do not delete catalog rows — profiles & listings still reference them.

update public.personas
set subtitle = 'Your own pace. Your own plot twist.'
where key = 'solo';

update public.personas
set title = 'With a Partner',
    subtitle = 'Dates, weekends, just the two of you.'
where key = 'couple';

update public.personas
set title = 'With Family',
    subtitle = 'Kids, parents, the whole crew.'
where key = 'family';

update public.personas
set title = 'With Friends',
    subtitle = 'The group chat actually left the house.'
where key = 'squad';

update public.personas
set title = 'Meeting New People',
    subtitle = 'Open to new faces & new plans.'
where key = 'new_in_town';

update public.personas
set is_active = false
where key = 'local';

update public.personas
set subtitle = 'Weekend away, or in town for a bit.'
where key = 'visitor';

update public.personas
set title = 'With Workmates',
    subtitle = 'After-work plans with the team.'
where key = 'work';

update public.activity_kinds set title = 'Social Sport' where key = 'team';
update public.activity_kinds set title = 'Shows & Events' where key = 'third-party';
update public.activity_kinds set title = 'Play & Games' where key = 'digital';
update public.activity_kinds set title = 'Classes & Making' where key = 'workshop';
update public.activity_kinds set title = 'Dates & Slow Days' where key = 'romance';
update public.activity_kinds set title = 'Nights Out' where key = 'nightlife';

update public.interests set title = 'Bungee Jumping' where key = 'bungy';
update public.interests set title = 'A Night Out' where key = 'night-drive';
update public.interests set title = 'Garden Walks' where key = 'secret-gardens';
update public.interests set title = 'Gaming Nights' where key = 'lan-parties';
update public.interests set title = 'Maker Spaces' where key = 'maker-labs';
update public.interests set title = 'Cocktail Classes' where key = 'mixology';
update public.interests set title = 'Hidden Bars' where key = 'speakeasies';
update public.interests set title = 'Vintage Finds' where key = 'vintage-hunting';
update public.interests set title = 'Flower Workshops' where key = 'floral-design';
update public.interests set title = 'Weekend Cricket' where key = 'social-cricket';

insert into public.interests (key, title, activity_kind_id, sort_order, is_active)
select v.key, v.title, k.id, v.sort_order, true
from (values
  ('braais', 'Braais', 'team', 9),
  ('beaches', 'Beaches', 'adventure', 9),
  ('coffee-dates', 'Coffee Dates', 'romance', 9),
  ('live-music', 'Live Music', 'nightlife', 9)
) as v(key, title, kind_key, sort_order)
join public.activity_kinds k on k.key = v.kind_key
on conflict (key) do update
set title = excluded.title,
    activity_kind_id = excluded.activity_kind_id,
    is_active = true;
