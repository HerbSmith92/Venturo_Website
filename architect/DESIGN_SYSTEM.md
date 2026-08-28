# Venturo design system

Locked from Brand Guide v1.2 (March 2025, file `02-brand-guide/brand-guide-V2.pdf`) plus the uploaded logo, font, icon, mascot, and photography packs.

This file is the source of truth for website and app UI. Do not invent a parallel palette, type stack, or voice.

## Brand

**Statement:** We’re Venturo. We provide a way for curious adventurers to easily find things to do and places to go in their local areas. We’re bold, brave and beyond excited to explore our towns and make memories with like-minded thrill-seekers & travellers.

**Values:** Adventurous · Curious · Bold · People-Focused · Make New Memories · Fulfilled

**Voice words:** Bold · Magical · Humorous · Insightful · Daring

Full voice and writing rules: [`03-brand-voice/BRAND_VOICE.md`](03-brand-voice/BRAND_VOICE.md)

## Colour

Use Night Sky and Snow Drift for backgrounds, headings, and body text. Always contrast text against the surface.

### Primary

| Name | Hex | RGB | Use |
| --- | --- | --- | --- |
| Snow Drift | `#EBEBF3` | 235, 235, 243 | Light surfaces, light logo plate |
| Night Sky | `#2A2D35` | 42, 45, 53 | Dark surfaces, headings, logo wordmark |

### Accent (activity groups)

Use sparingly: CTAs, category chips, themed illustrations. Each colour belongs to an activity group.

| Name | Hex | RGB | Inferred group (from icon pack) |
| --- | --- | --- | --- |
| Passionate Pomegranate | `#D54732` | 213, 71, 50 | Romance |
| Outrageous Orange | `#FF9E6B` | 255, 157, 107 | Thrills |
| Brainpower Pink | `#FF2EFF` | 255, 46, 255 | (unmapped in icon pack) |
| Cheerful Canary | `#F3BF4A` | 243, 191, 74 | Team |
| Black Currant | `#14001A` | 20, 0, 26 | Deep accent / nightlife support |
| Maroon Madness | `#971A21` | 151, 26, 33 | (unmapped in icon pack) |
| Digital Sapphire | `#7CC3E9` | 124, 195, 233 | Digital / workshop |
| Blissful Blush | `#DC729E` | 220, 114, 158 | Family |
| Velvet Vibes | `#5E589E` | 94, 88, 158 | Nightlife |
| Jungle Jade | `#45A67F` | 69, 166, 127 | Adventure |

Activity category icons in `08-icons-and-ui` use close cousins of these hexes, not always the exact brand tokens. **Ship the table above**, not the SVG fill values.

### Logo fills in the SVG pack

The digital SVGs use `#2F333D` and `#EEECF6`. Prefer the official tokens `#2A2D35` and `#EBEBF3` for UI. Do not recolour approved logo files.

## Typography

| Role | Font | Size (guide) | Notes |
| --- | --- | --- | --- |
| H1 | Social Gothic Rough | 32pt | Primary page heading |
| H2 | Social Gothic Rough | 22pt | Section heading |
| H3 | Social Gothic Rough | 18pt | Subsection |
| Body / Button | Nunito Extra Light | 14pt | Primary copy |
| Body 2 | Nunito Extra Light | 12pt | Meta, location, time |
| Mouse / micro | Nunito Extra Light | 8pt, all caps | Captions, tooltips, legal lines |

**Files on disk:**

- Social Gothic family in `04-fonts/Social-Gothic-Font/` (Regular, Medium, DemiBold, Bold, Rough, Soft, Stencil)
- Nunito family in `04-fonts/nunito/` including ExtraLight + OFL.txt

If Social Gothic Rough cannot be embedded, fallback is **Bowlby One SC** (OFL).

### Type commandments

- Left aligned, rag right
- Skip a weight and double size between paired text
- Align x-heights or baselines
- Line length 45–70 characters
- Group related items; keep real negative space
- Avoid orphans on the rag

## Logo

- **Default:** stacked (vertical) lockup, dark or light against a contrasting surface
- **Wide / short bars:** horizontal lockup
- **Rare:** simple lockups (no border) on flat merchandise or empty fields
- **Coloured logos:** only when the page is about that activity colour
- **Web placement:** top-left in the nav, same in the footer. Do not centre, even on mobile
- **Min size:** 100px wide digital, 55mm print
- **Clear space:** width of the letter V on all sides
- **Max size:** generally no larger than 33% of the canvas
- **Never:** stretch, recolour ad hoc, drop shadow, lower opacity, or sit on busy photos

Preferred website files:

- Light nav on Night Sky: `05-logos-and-marks/Main/Digital/SVG/Horizontal Light .svg` or stacked light
- Dark nav on Snow Drift: `05-logos-and-marks/Main/Digital/SVG/Horizontal Dark.svg` or stacked dark

Social avatars: simple stacked lockup, or Vee.

## Pattern

Pathway / sticker textures live in `05-logos-and-marks/Pathways/` (black and white, 3×5 set).

- **5% opacity** on dark empty areas
- **10% opacity** on light empty areas

## Mascot — Vee

Squirrel guide. Files in `02-brand-guide/03 Mascot/`.

- UI / web: keep the **flat** poses (Standing, Walking, Sitting, Hanging, Sky Diving)
- Photography composites: add **soft shadows** so Vee sits in the scene
- Custom: `Mario.png` is a special pose, not the default

## Icons

- Style: **iOS 17 Filled**, one family only
- Pack: `08-icons-and-ui/02 Icons/`
- Category marks: `venturo-activity-{compass,romance,thrill,disco,family,team,chip}.svg`
- Guide groups: Adventure, Digital, Romance, Thrills, Third party, Nightlife, Family, Team, Workshop

## Photography

Stock in `07-imagery-and-video/04 Stock/`.

- People in action, mid-experience, not posed product shots
- Story first: dates, friends, family, teams
- Pull brand colour into the frame when possible
- Type may sit between subject and background
- Do not put the logo on a busy photograph

## UI kit

### Grid

- 8px base scale
- Desktop: 12 columns, 8–32px gutters
- Tablet: 8 columns, 16–24px gutters
- Mobile: 4 columns, 8–16px gutters
- Max container: 1200–1440px

### Spacing

- 4–8px micro
- 12–24px component
- 32–64px layout
- 72–128px hero / page breaks

### Radius

- 12px buttons, tags, inputs
- 18px cards, modals
- 24px large containers and imagery

### Buttons

- Height 44–48px
- Vertical padding 8–16px, horizontal 16–24px
- Primary = main path, secondary / tertiary = supporting
- Inactive = 30% grey
- Label: Nunito Extra Light 14pt, vertically centred

### Elevation

Level 0 flat → Level 4 nav/dialogs. Use only to show hierarchy, not decoration.

## Still missing from the drop

1. Page copy (`10-copy-and-messaging/` is empty — voice rules exist)
2. Legal source files (`11-legal-and-policies/` is empty)
3. Confirm web licence for Social Gothic (pack came via daFont.Style)

Website + app prototypes are in `06-design-prototypes/`. Product architecture is in `09-ux-flows/PRODUCT_ARCHITECTURE.md`.
