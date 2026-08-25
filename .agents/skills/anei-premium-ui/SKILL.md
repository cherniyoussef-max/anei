---
name: anei-premium-ui
description: Design and implement premium ANIE product UX/UI using the existing ANIE brand, design system, responsive layouts, FR/AR/RTL support, accessibility, and learning-product UX. Use for any user-facing ANIE interface.
---

# ANIE Premium Product Design

## Goal

Build a distinctive premium education product, not a generic SaaS dashboard.

Preserve ANIE brand identity while improving:
- usability
- clarity
- hierarchy
- accessibility
- responsiveness
- perceived quality
- learning continuity

## Before editing

Read only what is needed:

1. docs/design/ANEI_DESIGN_SYSTEM.md if present
2. docs/design/UI_INVENTORY.md if present
3. relevant route
4. relevant shared components
5. existing styling/theme primitives

Do not rediscover the entire repository.

Inspect reference images under:

docs/design/reference/

## Visual direction

Primary reference:
concept-navy-gold

Brand reference:
current-anie-brand

Do NOT copy concept-blue stylistically except where its interaction pattern is
better.

Desired identity:

warm
calm
credible
inclusive
premium
human
precise

Avoid:

- generic SaaS appearance
- excessive gradients
- excessive glassmorphism
- excessive shadows
- giant rounded cards
- random colors
- unnecessary dashboards full of statistics
- decorative animation
- inconsistent spacing
- excessive gold
- tiny text
- dense institutional UI

## Color

Extract actual ANIE brand colors from repository assets/theme.

Create semantic tokens, not page-local hex values.

Examples conceptually:

--brand-primary
--brand-primary-hover
--brand-accent
--surface-page
--surface-card
--surface-elevated
--text-primary
--text-secondary
--text-muted
--border-subtle
--success
--warning
--danger
--info

Gold is an accent, not a default background.

## Typography

Use a coherent type scale.

Strong hierarchy:

display
h1
h2
h3
body
body-small
caption
label

Verify French and Arabic rendering.

Do not introduce a font that degrades Arabic or performance.

## Grid

Use consistent responsive layout.

Desktop:
12-column logic where appropriate.

Tablet:
adaptive grid.

Mobile:
single-column priority flow.

Use a spacing system based on a small token scale.

## Components

Prefer reusable primitives:

Button
IconButton
Input
Select
Search
Card
Progress
Badge
Avatar
Tabs
Dialog
Drawer
Tooltip
Toast
Skeleton
EmptyState
ErrorState
PageHeader
Stat
CourseCard
LessonRow
ProgressRing

Do not create visually different versions for every page.

## Motion

Motion should communicate state.

Typical:
150–250ms.

Use:
opacity
transform
small scale
layout transitions

Avoid decorative continuous animation.

Respect prefers-reduced-motion.

## Student dashboard

Primary job:

answer immediately:

"What should I do next?"

Priority:

1. Continue learning
2. Current progress
3. Upcoming work/session
4. My courses
5. Resources/certificates
6. Recommendations

Do not lead with a wall of analytics.

## Course player

Optimize for focus.

Support:

- collapsible curriculum
- clear current lesson
- resume position
- progress
- previous/next
- completion
- transcript/captions where available
- resources
- responsive layout
- keyboard navigation
- loading/error states

## Catalog

Cards must make comparison easy.

Show only useful information:

title
skill/topic
level
duration
instructor
certificate
price
progress if enrolled

Filtering/search must be obvious.

## Personas

Do not show the same dashboard with different labels.

Student:
learning and progress.

Parent:
child status and support actions.

AVS:
students/cases, appointments, resources.

Teacher:
courses/cohorts, learners, tasks.

Admin:
operations, exceptions, analytics.

## FR / AR / RTL

Every changed screen must be verified in:

French LTR
Arabic RTL

Do not fake RTL by text alignment only.

Check:

layout direction
icons
chevrons
progress
navigation
tables
drawers
forms

## Accessibility

Target WCAG-quality implementation.

Require:

keyboard use
visible focus
semantic landmarks
labels
ARIA only when necessary
contrast
44px-ish touch targets where practical
screen-reader meaningful text
reduced motion

## States

Every data surface must consider:

loading
empty
error
success
disabled
offline/provider failure where relevant

No blank screens.

## Engineering

Do NOT change backend/domain/auth semantics during visual work.

Reuse existing services and APIs.

Do not add a new UI framework without proving existing primitives are
insufficient.

Do not add a dependency for a trivial component.

Keep server/client component boundaries deliberate.

## Verification

After each route:

- typecheck relevant code
- targeted tests
- desktop visual check
- tablet visual check
- mobile visual check
- French
- Arabic RTL
- browser console
- keyboard smoke
- no horizontal overflow

Use anei-visual-qa when appropriate.

## Output

Return:

changed screens
design decisions
reused components
new components
responsive verification
RTL verification
accessibility findings
remaining issues
