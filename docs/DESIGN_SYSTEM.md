# ANEI design system

## Product character
ANEI should feel like a credible educational institution and premium learning product: calm, inclusive, clear and modern. Avoid excessive glassmorphism, decorative motion, huge gradients or dashboard clutter.

## Semantic tokens
The global CSS exposes semantic aliases over the established institutional palette:
- `--primary`: institutional blue/action color;
- `--primary-soft`: low-emphasis selection/background;
- `--surface`: primary card surface;
- `--surface-soft`: secondary/quiet surface;
- `--ink`: primary text;
- `--muted`: secondary text;
- `--border`: subtle separators/field/card edges;
- `--radius-md` / `--radius-lg`: reusable geometry;
- `--shadow-soft` / `--shadow`: hierarchy rather than decoration;
- `--focus`: visible keyboard focus treatment.

Prefer semantic tokens in new UI rather than inventing a new blue/gray/radius for each component.

## Core patterns
- **Primary button:** one dominant action per local context.
- **Secondary/ghost button:** lower-priority or reversible action.
- **Cards:** strong information hierarchy; hover effects must not be the only way to discover an action.
- **Forms:** persistent labels, server error feedback, disabled/loading states, no placeholder-only labels.
- **Tables:** server pagination/filtering for operational datasets; mobile horizontal containment or alternate layout.
- **Status:** use text/icon plus color, never color alone.
- **Navigation:** sticky public header, clear learner/admin context, touch-friendly mobile navigation.
- **Learning workspace:** course progress, grouped modules, lesson state, previous/next/resume actions, media and attachments in one focused workspace.

## Responsive baseline
Check important pages around 320px, common phone sizes, tablet, laptop and wide desktop. No required action may exist only on hover. Avoid fixed widths that produce page-level horizontal overflow.

## RTL
Arabic is a first-class layout, not just translated strings. Use logical CSS (`margin-inline`, `inset-inline`, etc.) for direction-sensitive layout; preserve semantic direction for media/player controls and icons when mirroring would change meaning.

## Accessibility
Target WCAG 2.2 AA engineering quality:
- semantic landmarks/headings;
- visible focus;
- keyboard access;
- adequate contrast;
- accessible names/labels/errors;
- reduced-motion support;
- captions/transcripts architecture for learning media;
- no information conveyed by color alone.

## Motion
Use short transitions for state/feedback only. Respect `prefers-reduced-motion`; do not block navigation or learning behind animation.
