# ANEI Design System — v3.4

## 1. Product character
ANEI is a bilingual professional learning platform for inclusive education. It must feel credible enough for institutions, human enough for educators and families, and focused enough for daily professional learning.

### Design principles
1. **Human before ornamental** — use real-feeling documentary learning imagery where it adds context; never decorate with meaningless illustration.
2. **Editorial hierarchy** — typography, image crop, whitespace, and rhythm create premium perception before shadows or effects.
3. **Learning-first** — every learner surface answers: what am I learning, where am I, and what should I do next?
4. **Inclusive by default** — WCAG-oriented contrast, keyboard access, 44px targets, reduced motion, semantic states, and genuine RTL are mandatory.
5. **Institutional confidence** — blue/slate remains the visual anchor; warm neutral surfaces keep the experience humane rather than corporate-cold.
6. **One product, three modes** — public, learner, and admin share tokens but use distinct composition and density.
7. **No fake affordances or metrics** — every visible action and data point must map to real product behavior.

## 2. Visual direction
**Human Editorial Institutional** = refined Swiss/editorial structure + documentary learning photography + accessible product UI + restrained enterprise density.

The memorable ANEI signature is: strong cobalt framing, warm documentary photography, compact uppercase eyebrows, editorial headlines, and precise operational surfaces.

Avoid child-oriented education styling, teal-led branding, amber global CTAs, glassmorphism, purple AI gradients, floating decorative orbs, huge radii, fake dashboards, emoji icons, and excessive motion.

## 3. Photography system
Photography is part of the product system, not filler.
- Prefer authentic-looking professional learning moments: study, facilitation, collaboration, reflection, course participation.
- Do not visually assign generated faces to named real people, trainers, or AVS profiles.
- Hero/editorial photos may depict anonymous learners or facilitators.
- Crop for human focus and workspace context; keep overlays simple and readable.
- Use local optimized WebP assets in production.
- Photos never replace semantic information such as labels, trainer names, status, or progress.

## 4. Core color tokens
- Primary cobalt: `#2559D6`
- Primary hover: `#1745B8`
- Deep navy: `#0B172A`
- Navy surface: `#0C1D39`
- Main text: `#2D3A4F`
- Muted: `#68758A`
- Background: `#F6F8FB`
- Surface: `#FFFFFF`
- Cool subtle surface: `#F1F4F8`
- Warm subtle surface: `#F6F3EE`
- Border: `#DFE5EE`
- Strong border: `#C9D2DF`
- Success: `#14765A`
- Success subtle: `#EAF6F1`
- Danger: `#B91C1C`
- Warning: `#B45309`

Color is semantic. No status may rely on color alone.

## 5. Typography
Use a professional UI sans stack with Arabic parity.
- Latin: Inter when available, then system UI / Segoe UI.
- Arabic: Noto Sans Arabic when available, then Tahoma / Arial.
- Display/H1 uses compact tracking and shorter line measure; body text remains comfortable and readable.
- Body baseline: 16px, 1.6–1.7 line height.
- Small UI text should generally remain >=12px.
- Tabular numerals for data-heavy admin surfaces.

## 6. Layout and spacing
4/8px rhythm. Public pages are spacious; learner surfaces are focused; admin is denser.
- Main container: 1260px max.
- Reading measure: 60–75ch desktop.
- Section spacing: ~72–96px depending on density.
- Hero uses editorial split composition, not centered SaaS composition.
- Mobile composition prioritizes content instead of mechanically stacking decorative elements.

## 7. Radius and elevation
- Controls: 8–9px
- Compact panels: 9–11px
- Object cards: 10–14px
- Large photo frames / signature surfaces: 16–22px
- Pills only for status, mode, or compact tags

Borders provide structure. Shadows are low-frequency and reserved for elevated photos, overlays, and important cards.

## 8. Controls and forms
Buttons: primary / secondary / outline / ghost / danger. One visually dominant primary action per local decision area.
Inputs use visible labels, 44px+ height, strong focus ring, inline error/recovery feedback, proper autocomplete, and RTL-aware alignment.

## 9. Cards
Cards are objects, not default layout wrappers.
- Courses: photographic cover + category/level + title + concise description + metadata + trainer + price/action.
- AVS: identity and credentials remain text-led; do not attach generated portraits to named profiles.
- Admin: border-led, compact, almost no decorative elevation.

## 10. Public experience
The public site is an institutional learning publication plus discovery product.
- Header: concise navigation, search, language, account.
- Homepage: mission + search + real learning opportunities + human editorial story + webinars + network + resources + news.
- Course catalog: search/filter first, compact photo cards, clear result count.
- Course detail: editorial title, meaningful metadata, photographic enrollment context, curriculum and outcomes.

## 11. Learner experience
The dashboard is a learning cockpit.
- Continue Learning remains the primary object.
- Human imagery is contextual and secondary to progress/action.
- KPIs are compact, not decorative analytics.
- Course player minimizes non-learning chrome, keeps curriculum orientation, and preserves progress context.

## 12. Admin experience
Dedicated operational back-office.
- Dark navy sidebar, compact content surfaces, visible filters, tabular data, explicit statuses.
- No marketing hero or photography inside CRUD operations.
- Dense tables and forms remain readable at professional working speeds.

## 13. Motion
120–200ms interaction motion. Image cards may use a very small scale on hover. Avoid decorative entrance choreography and respect `prefers-reduced-motion`.

## 14. Accessibility
Target WCAG 2.2 AA: visible focus, semantic headings/landmarks, keyboard menus, labels, reduced motion, adequate target sizes, descriptive alt text for meaningful photography, and no color-only states.

## 15. RTL
Arabic is first-class. Use logical properties and validate header, filters, cards, arrows, course navigation, learner sidebar, tables, dialogs, and forms independently in RTL.

## 16. Responsive validation
Validate at minimum: 375, 768, 1024, 1280, 1440+. No page-level horizontal scroll. Tables may scroll inside dedicated containers. Human imagery crops must remain useful on mobile.

## 17. Anti-patterns
- Baloo / Comic Neue or childish typography
- generic SaaS bento-grid homepage
- purple-blue AI gradients
- glass cards and floating gradient blobs
- excessive pill buttons
- giant 24–32px radii everywhere
- generated portraits presented as named real staff
- fabricated testimonials or metrics
- inactive UI controls
- hidden focus outlines
