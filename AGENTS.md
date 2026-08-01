# ANEI Development Instructions

## Product

ANEI is a bilingual French/Arabic professional inclusive education platform.

It contains three distinct product experiences:

1. Public institutional website
2. Learner LMS
3. Admin Console

Never visually merge these three experiences.

## Design quality

For frontend work, use these Codex skills when relevant:

- $design-taste-frontend
- $impeccable
- $emil-design-eng
- $design-system-patterns
- $visual-design-foundations
- $responsive-design
- $accessibility-compliance

Use $design-taste-frontend before major redesign decisions.

Use $impeccable after implementation for strict critique and polish.

Use $emil-design-eng for interaction and motion refinement.

The canonical ANEI design system is:

design-system/anei/MASTER.md

Also read page-specific rules from:

design-system/anei/pages/

Do not invent a new visual system independently on every page.

## Desired brand perception

ANEI must feel:

- professional
- institutional
- premium
- human
- trustworthy
- inclusive
- academic
- modern

Avoid:

- childish visuals
- cartoonish UI
- generic SaaS templates
- generic AI-generated layouts
- excessive glassmorphism
- random gradients
- huge rounded cards
- excessive shadows
- oversized marketing headings
- decorative blobs
- emoji icons
- fake metrics
- fake testimonials

## Public website

The public experience should feel:

- editorial
- institutional
- human
- educational
- credible

Use strong typography, meaningful imagery, whitespace, and clear hierarchy.

Do not make the homepage look like a generic startup landing page.

## Learner LMS

The learner experience should feel:

- focused
- calm
- productive
- motivating
- easy to navigate

Learning progress, course continuation, lessons, certificates, and profile actions must be visually clear.

Do not overload the learner dashboard with unnecessary cards.

## Admin Console

The admin area must feel like a separate enterprise application.

It must have its own:

- shell
- sidebar
- navigation
- page headers
- tables
- analytics
- filters
- forms
- operational workflows

Do not reuse the public website header or footer inside admin.

Admin UI should prioritize:

- precision
- information density
- scanability
- operational clarity

## Typography

Typography hierarchy should do most of the visual work before adding cards or shadows.

Use professional Latin and Arabic typography.

French and Arabic must receive equal visual quality.

Arabic must support true RTL behavior.

## Photography

Use human imagery only when it contributes meaning.

Preferred themes:

- inclusive education
- educators
- teacher training
- classroom collaboration
- professional learning
- accessibility
- digital education
- certification
- educational communities

Avoid generic corporate stock imagery.

Do not associate generated faces with named real staff, trainers, AVS professionals, or identifiable people.

## Motion

Motion must be purposeful.

Good uses:

- menu opening
- dialogs
- accordions
- progress transitions
- loading feedback
- hover feedback
- state changes

Avoid decorative animation.

Respect prefers-reduced-motion.

## Responsive design

Every major page must be validated at:

- 375px
- 768px
- 1024px
- 1280px
- 1440px

There must be no accidental horizontal overflow.

Tables need deliberate mobile behavior.

Do not simply shrink desktop interfaces.

## Accessibility

Target WCAG 2.2 AA.

Always verify:

- keyboard navigation
- visible focus
- contrast
- semantic headings
- accessible forms
- labels
- ARIA where necessary
- dialogs
- touch target sizes
- reduced motion
- screen reader behavior
- RTL behavior

## Functional integrity

Never replace real functionality with visual mockups.

Do not add buttons that do nothing.

Do not invent metrics that do not exist in the database.

Preserve existing business logic unless a change is explicitly justified.

## Security

Never weaken:

- Better Auth
- RBAC
- server-side authorization
- CSRF/origin checks
- secure cookies
- rate limiting
- database constraints
- API validation
- payment verification
- security headers

Never expose:

- passwords
- secrets
- OAuth tokens
- database credentials
- Google client secret

Admin authorization must be enforced server side.

## Backend and data

Prefer the existing modular monolith architecture.

Do not introduce microservices without measurable justification.

Do not fetch large datasets into Node when PostgreSQL can aggregate them.

Avoid:

- N+1 queries
- SELECT *
- unnecessary joins
- client-side pagination of full datasets
- repeated queries

Preserve Drizzle, PostgreSQL, Redis, and Better Auth unless there is a strong documented reason to change them.

## Images and assets

Use optimized local assets where appropriate.

Prefer:

- next/image
- responsive image sizes
- WebP/AVIF where suitable
- lazy loading below the fold

Do not degrade Core Web Vitals for visual effects.

## Visual verification workflow

For every major page:

1. inspect existing implementation
2. define design direction
3. implement
4. run the application
5. inspect in browser
6. capture desktop screenshot
7. capture mobile screenshot
8. critique using $impeccable
9. improve interaction using $emil-design-eng where needed
10. check responsive behavior
11. check accessibility
12. inspect again

Do not mark visual work complete from code inspection alone.

Use Playwright for browser verification.

## Testing

After meaningful changes, run relevant checks.

For major milestones run:

npm run deps:check
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run security:audit
npm run build
npm run check

Run Playwright E2E tests when frontend behavior changes.

Never suppress failures just to make validation pass.

## Git workflow

Current protected baseline branch:

main

Current redesign branch:

redesign-v4

Do redesign work only on redesign-v4 unless explicitly instructed otherwise.

Create logical commits after stable milestones.

Do not rewrite or force-reset main.

## Definition of done

A task is not complete merely because it compiles.

A major frontend task is complete only when it is:

- functionally correct
- visually coherent
- responsive
- accessible
- bilingual
- RTL-safe
- tested
- consistent with the ANEI design system
