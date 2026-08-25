# ANEI Design System

Status: implementation-ready foundation  
Scope: public site, learner product, professional persona portals, and Admin Console  
Primary reference: `reference/concept-navy-gold.png`  
Brand authority: `reference/current-anie-brand.jpeg`  
Interaction reference only: `reference/concept-bleu.png`

## 1. Design read

ANEI is a bilingual professional learning institution, not a generic education marketplace. The product language is calm, warm, credible, inclusive, precise, and human. Navy provides authority, cream softens the institution, cobalt carries digital interaction, and gold marks distinction in small amounts.

Working design dials:

- Design variance: 4 of 10. Editorial asymmetry is allowed on public pages; product workflows remain predictable.
- Motion intensity: 3 of 10. Motion explains state, hierarchy, or continuity.
- Visual density: 5 of 10. Learner surfaces are focused; Admin Console may reach 7 of 10.

ANEI has three visually distinct modes that share tokens, type, icons, and interaction rules:

1. Public site: editorial, spacious, photographic, institutional.
2. Learner and professional portals: focused, calm, task-led, personal.
3. Admin Console: compact, operational, data-led, no marketing treatment.

## 2. Brand principles

1. Learning continuity first. A learner always sees the next useful action.
2. Human evidence over decoration. Photography must explain an educational context.
3. Institutional confidence without coldness. Navy structure is balanced by warm light surfaces.
4. Typography before containers. Use hierarchy and spacing before cards or shadows.
5. Inclusive by construction. French and Arabic receive equal layout quality.
6. Real product evidence only. Do not invent metrics, testimonials, credentials, or progress.
7. One language, distinct modes. Public, learning, and administration must never look like the same shell.

## 3. Brand assets

- Preserve the existing ANEI name and approved institutional mark. Do not silently replace the logo with a new symbol.
- Prepare one production logo asset with navy artwork for light surfaces and one reversed asset for navy surfaces.
- Keep the wordmark legible at 32px total height. The tagline may disappear below 420px.
- Never place the logo over busy photography without a solid or sufficiently opaque surface.
- Use the existing local learning photography in `public/media/` where its subject and crop match the content.
- Generated or stock faces must remain anonymous. Never present them as named staff, learners, trainers, AVS professionals, or specialists.

## 4. Semantic color system

The existing repository already establishes cobalt `#2559D6`, deep navy `#0B172A`, warm surface `#F6F3EE`, cool page `#F6F8FB`, and status colors. These remain the source palette. Gold is derived from the established ANEI mark and the navy/gold concept, but is restricted to distinction and emphasis.

```css
:root {
  color-scheme: light;

  --brand-navy-950: #0b172a;
  --brand-navy-900: #0c1d39;
  --brand-navy-800: #102e72;
  --brand-cobalt-600: #2559d6;
  --brand-cobalt-700: #1745b8;
  --brand-gold-500: #c9953f;
  --brand-gold-600: #a97828;

  --surface-page: #f6f8fb;
  --surface-card: #ffffff;
  --surface-subtle: #f1f4f8;
  --surface-warm: #f6f3ee;
  --surface-navy: var(--brand-navy-950);
  --surface-navy-raised: var(--brand-navy-900);

  --text-primary: #0b172a;
  --text-secondary: #2d3a4f;
  --text-muted: #68758a;
  --text-on-dark: #f7f9fc;
  --text-on-dark-muted: #b8c5d6;

  --border-subtle: #dfe5ee;
  --border-strong: #c9d2df;
  --border-on-dark: rgb(255 255 255 / 16%);

  --action-primary: var(--brand-cobalt-600);
  --action-primary-hover: var(--brand-cobalt-700);
  --action-secondary: var(--brand-navy-950);
  --focus-ring: #5b82ed;

  --status-success: #14765a;
  --status-success-subtle: #eaf6f1;
  --status-warning: #9a5b08;
  --status-warning-subtle: #fff5df;
  --status-danger: #b91c1c;
  --status-danger-subtle: #fdefef;
  --status-info: #2559d6;
  --status-info-subtle: #edf3ff;
}
```

Rules:

- Cobalt is the default interactive color and must not be renamed to a visual color such as `blue` in component APIs.
- Gold is for the logo, certificate details, selected learning milestones, and rare editorial accents. It is not a default button or large background.
- Navy is the public and admin structural anchor. Avoid page-sized navy learner surfaces except the Continue Learning object or course-player chrome.
- Status meaning includes an icon or text label, never color alone.
- No random course color palette. Course differentiation uses imagery, category text, and at most a tokenized category accent.
- Do not add purple, teal, or gradient accents unless data semantics require a distinct status and the design system is updated centrally.

## 5. Typography

### Families

- Latin UI and body: the existing professional sans stack until a licensed, self-hosted replacement is approved.
- Arabic UI and body: `Noto Sans Arabic`, then Tahoma and Arial. Load with `next/font` or self-hosted files and `font-display: swap`.
- Editorial display: the current Fraunces experiment must not become a platform-wide default. It may be retained only on selected public institutional headings after French and Arabic parity review. Product, auth, learner, and admin headings use the sans family.
- Never render Arabic in a Latin display face. Arabic line height and weight are specified independently.

### Type tokens

| Token | Desktop | Mobile | Line height | Use |
| --- | ---: | ---: | ---: | --- |
| `display` | 56px | 40px | 1.05 | Public hero only |
| `h1` | 40px | 32px | 1.12 | Page title |
| `h2` | 30px | 26px | 1.18 | Major section |
| `h3` | 22px | 20px | 1.25 | Object or panel title |
| `body-lg` | 18px | 17px | 1.65 | Lead copy |
| `body` | 16px | 16px | 1.6 | Default reading |
| `body-sm` | 14px | 14px | 1.5 | Metadata and supporting text |
| `label` | 14px | 14px | 1.35 | Control label |
| `caption` | 12px | 12px | 1.4 | Timestamps and compact metadata |

Arabic adjustments:

- Increase line height by approximately 0.1 compared with the equivalent Latin token.
- Avoid negative letter spacing and uppercase transformations.
- Use weights 500 to 700 for hierarchy; do not rely on extreme weight contrast.
- Keep Arabic body measure between 45 and 65 characters where possible.
- Use tabular numerals for admin data but preserve the locale's configured numeral system.

## 6. Spacing, grid, and containers

Base scale: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96` pixels.

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;
--space-20: 5rem;
--space-24: 6rem;
```

- Public max container: 1260px, with 12-column logic at 1024px and above.
- Learner max container: 1320px. Shell uses a 240px navigation rail plus flexible content.
- Reading column: 680 to 760px depending on language and content type.
- Admin content: fluid inside the shell, capped at 1600px only on very wide displays.
- Page gutters: 20px at 375px, 32px at 768px, 40px at 1024px, 48px at 1280px and above.
- Public section gap: 80 to 112px. Product page gap: 32 to 64px. Admin page gap: 16 to 32px.
- At less than 768px, multi-column product flows become one priority-ordered column. Decorative media may be removed, never placed before the primary action.

## 7. Breakpoints

| Name | Width | Purpose |
| --- | ---: | --- |
| `xs` | 375px | Small phone validation target |
| `sm` | 640px | Wide phone and compact form adjustments |
| `md` | 768px | Tablet and primary single-column transition |
| `lg` | 1024px | Product shell and desktop navigation threshold |
| `xl` | 1280px | Full 12-column composition |
| `2xl` | 1440px | Wide desktop validation target |

Use container queries for reusable cards and toolbars when their behavior depends on available component width rather than viewport width.

## 8. Shape, border, and elevation

```css
--radius-control: 8px;
--radius-panel: 12px;
--radius-object: 14px;
--radius-feature: 18px;
--radius-pill: 999px;

--shadow-raised: 0 12px 32px rgb(11 23 42 / 8%);
--shadow-overlay: 0 24px 64px rgb(11 23 42 / 18%);
```

- Controls use 8px. Panels use 12px. Course and resource objects use 14px. Large media frames may use 18px.
- Pills are limited to statuses, compact filters, and categorical tags.
- Borders are the default separator. Use `shadow-raised` only when an object is physically above another surface.
- Admin cards and tables use no decorative shadow.
- Do not use glassmorphism.

## 9. Iconography

- Consolidate the current hand-maintained icon paths into one established icon family already approved for the project, preferably Phosphor or Tabler. Do this as a planned refactor, not page by page.
- Standard size: 20px; compact: 16px; prominent: 24px.
- Standard stroke weight: visually equivalent to 1.75 to 2px.
- Icons support labels and state; they do not replace unfamiliar text labels.
- Directional icons mirror in RTL. Media playback, download, check, calendar, and brand marks do not mirror.
- No emoji icons.

## 10. Core components

### Buttons

Variants: primary, secondary, outline, ghost, danger, and text link.

- Minimum height: 44px; compact admin controls may be 36px with a 44px combined touch target on mobile.
- Primary uses cobalt on light surfaces and a light fill on navy surfaces.
- One primary action per local decision area.
- Button labels remain on one line at desktop.
- Loading preserves width and announces busy state. Disabled state remains legible and cannot rely on opacity below 50 percent.
- Hover changes color or elevation by one level. Active uses a subtle 1px translation or 0.98 scale. Focus uses a 2px outline with 2px offset.

### Inputs and selects

- Persistent visible label above every field.
- Helper text below the control; error replaces or follows helper text without moving unrelated content.
- Minimum height: 44px; text area minimum: 120px.
- Placeholder is an example, not a label.
- Required and optional state is textual.
- Search has a visible submit behavior on mobile and may submit on Enter.
- Password fields provide a show/hide control with an accessible name.
- OTP fields support paste, autocomplete, resend timing, and a single-field fallback for assistive technology.

### Cards and rows

- `CourseCard`: cover, category, title, level, duration, instructor, certificate availability, price or enrollment progress, and one action.
- `ResourceCard`: type, title, summary, access state, price or download action.
- `LessonRow`: completion state, lesson title, duration, current state, and lock state where applicable.
- `PersonRow`: name, relationship or assignment, relevant next action, and status.
- Use rows with spacing and dividers for repeated operational content. Do not wrap every section in a card.

### Progress

- Determinate progress always exposes a numeric accessible value.
- Continue Learning may use one prominent ring or bar, not both.
- Course lists use a compact bar and text percentage.
- RTL changes reading order but not the meaning of completion. Prefer logical positioning and test whether the chosen visual fill direction matches user expectation.
- Indeterminate loading is a skeleton, not fake progress.

### Badges

Badges are semantic: status, certification, access, mode, or level. Each uses text. Gold is reserved for achievement or ANEI-verified distinction.

### Navigation

- Public header: logo, five or fewer primary discovery items, language, search, and account action. Desktop height 64 to 72px.
- Learner shell: product rail with Continue, My Courses, Sessions, Resources, Certificates, and Profile. The public footer is absent.
- Professional persona shell: role-specific navigation and assignments. It shares product chrome, not student content.
- Admin shell: fixed navy sidebar, grouped operational navigation, top utility bar, and no public header or footer.
- Current location uses text, shape, and `aria-current`, not color alone.

### Tables

- Sticky header where the table scrolls vertically.
- Left or inline-start aligned labels; numbers inline-end aligned with tabular numerals.
- Sorting control has a visible label and announced direction.
- Bulk actions appear only after selection.
- At less than 768px choose one deliberate pattern: priority columns with details drawer, stacked records, or a contained horizontal scroller. Never shrink all columns until unreadable.

### Dialogs and drawers

- Dialog for focused confirmation or short editing. Drawer for contextual detail, filters, curriculum, or mobile navigation.
- Focus is trapped, return focus is preserved, Escape closes when safe, backdrop click never discards unsaved work silently.
- Mobile drawers use full height and a maximum width of 92vw.
- Destructive confirmation names the affected object and consequence.

### Toasts

- Use for transient confirmation or background completion.
- Inline messages handle validation, permission, payment, and persistent provider errors.
- Toasts are polite live regions, pause on hover/focus, and never contain the only recovery action.

### Skeletons and states

- Skeleton geometry matches the final object and is marked hidden from assistive technology.
- Empty states explain why the surface is empty and provide one valid next action.
- Error states identify the failed scope, preserve user input, and offer retry or support.
- Permission denied states distinguish missing access from missing content.
- Provider unavailable states name the affected capability without exposing infrastructure details.

## 11. Focus and accessibility

- Target WCAG 2.2 AA.
- Use semantic landmarks and one `h1` per page.
- All interactive elements are reachable and operable with keyboard only.
- Focus is always visible: `2px solid var(--focus-ring)` with 2px offset.
- Skip links target the actual main element in every shell, including Admin Console.
- Body text contrast is at least 4.5:1; large text and essential boundaries meet at least 3:1.
- Interactive targets are approximately 44px by 44px on touch screens.
- Form errors use `aria-describedby`; page summaries focus on submit failure when multiple fields fail.
- Status updates use the least disruptive appropriate live region.
- Decorative images have empty alt text. Meaningful images describe purpose, not appearance alone.
- Never hide focus outlines or lock zoom.

## 12. Motion

```css
--duration-fast: 120ms;
--duration-standard: 180ms;
--duration-slow: 240ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

Approved uses:

- Menu, drawer, accordion, dialog, filter disclosure, and state transitions.
- Progress updates after confirmed data changes.
- Small hover feedback on interactive course imagery.
- Skeleton to content crossfade without layout shift.

Rules:

- Animate opacity and transform only where possible.
- No decorative entrance sequence, parallax, continuous shimmer after load, or scroll hijacking.
- `prefers-reduced-motion: reduce` removes spatial movement and uses instant or short opacity changes.
- Motion never delays access to course content or admin actions.

## 13. RTL contract

- Set `lang` and `dir` on the document root from the route locale.
- Use logical properties: inline start/end, margin inline, padding inline, inset inline, and logical border properties.
- Reverse shell placement, navigation order, breadcrumb flow, table priority order, drawers, and directional transitions.
- Mirror arrows, chevrons, next/previous controls, and disclosure direction.
- Do not mirror play, check, award, download, calendar, media timeline, or the ANEI logo.
- Do not reverse numeric values, email addresses, certificate codes, URLs, or phone numbers. Isolate them with `dir="ltr"` where necessary.
- Arabic mobile navigation opens from inline start.
- Test focus order after visual reversal. DOM order must remain meaningful.
- Avoid hard-coded left/right copy in accessible labels.

## 14. Product mode specifications

### Public

- Light editorial theme with navy anchors and documentary photography.
- Split or offset hero composition, concise primary navigation, generous reading space.
- Search and real learning inventory are prioritized above generic institutional claims.
- No learner analytics, admin tables, or product rail.

### Learner and professional portals

- Calm light workspace with a dedicated product shell.
- Continue Learning or the persona's primary work object is first.
- Photography is optional contextual support and never competes with the next action.
- Metrics are compact supporting evidence, not a wall of cards.
- No public footer inside authenticated workspaces.

### Admin Console

- Dedicated navy sidebar and neutral dense workspace.
- Page header includes title, context, and at most one dominant create action.
- Filters precede result count and table.
- Tables, forms, audit logs, and exception states favor scanability over visual flourish.
- No photography, editorial hero, gold background, or course marketing card.

## 15. Quality gates

Every changed major route must be checked at 375, 768, 1024, 1280, and 1440px in French LTR and Arabic RTL. Verification includes keyboard navigation, visible focus, no page-level horizontal overflow, reduced motion, screen-reader names, loading/empty/error/success states, browser console, and functional actions. Frontend work is not complete from code inspection alone.
