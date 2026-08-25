# ANEI UX Roadmap

Status: design foundation and implementation sequence  
Constraint: preserve backend, auth, payment, authorization, and data semantics unless a separate product decision approves change.

## 1. Definitive visual direction

ANEI will use the navy/gold/cream concept as the product composition reference and the existing ANEI brand as the identity authority. The result is not a copy of either image.

- Navy provides institutional structure and focused product chrome.
- Existing cobalt remains the digital action color.
- Cream is a warm secondary surface, not the universal page background.
- Gold marks certification, distinction, and small brand moments.
- Documentary educational photography is reserved for public storytelling and selective learner context.
- Product hierarchy comes from typography, spacing, dividers, and task order.
- The colorful concept contributes only interaction ideas such as obvious active states, compact filters, and readable progress.

## 2. Navigation architecture

### Public navigation

Primary desktop navigation:

1. Formations
2. Webinaires
3. Ressources
4. Réseau AVS
5. Actualités

Utilities: search, French/Arabic switch, account action. About and Contact remain accessible through the footer and contextual links unless product analytics justify primary placement.

Mobile uses a full-height drawer with clear groups: Discover, Academy, Account, Language. It restores focus to the trigger and closes on route selection.

### Learner navigation

Dedicated authenticated shell:

1. Continue
2. My Courses
3. Sessions
4. Resources
5. Certificates
6. Profile and Security

Desktop uses a 232 to 248px rail. Tablet uses a compact rail or top product bar depending on available width. Mobile uses a top bar plus a bottom or drawer navigation with no more than five primary destinations; Profile may live in the account menu.

### Professional persona navigation

All professional portals use the same shell mechanics but role-specific labels and destinations.

- Parent: Children, Progress, Sessions, Resources, Support.
- AVS: Assigned learners, Appointments, Follow-up, Resources, Public profile.
- Teacher: Cohorts, Learners, Sessions, Tasks, Resources.
- Specialist: Assigned cases, Appointments, Follow-up, Resources.
- Organization: Members, Invitations, Learning, Profile, where supported by current services.

Do not render unavailable destinations. A roadmap item is not a navigation item.

### Admin navigation

Keep the dedicated Admin Console. Consolidate information architecture into:

1. Overview
2. People
3. Learning
4. Content
5. Organizations and CRM
6. Commerce
7. Communication
8. Governance and System

Use expandable groups only when they reduce, rather than hide, navigation complexity. Preserve direct URLs and redirects for legacy route aliases.

## 3. Student dashboard architecture

The dashboard answers five questions in this order:

1. What should I continue now?
2. How am I progressing?
3. What is coming next?
4. What courses and resources do I have?
5. What did I achieve?

### Desktop anatomy

```text
Product rail | Page header: greeting, notifications, account
             | Continue Learning: course, next lesson, resume, progress
             | Progress summary | Next session
             | My courses: active first, completed after
             | Resources | Certificates
             | Optional recommendations only when backed by real data
```

- Continue Learning occupies the first and strongest content position.
- Show the next lesson title and saved position when available.
- Progress summary uses one compact grouped surface, not four equal KPI cards.
- Upcoming displays the nearest actionable event and then a short list.
- Notifications open a real list or are omitted until that surface exists.
- The AI assistant entry point is a restrained labeled action near the product utility area. It must explain scope and data use, preserve conversation state, and never imply human expertise. Do not show it if the current AI capability is not enabled and authorized.

### Tablet anatomy

- Compact navigation rail or top product bar.
- Continue Learning full width.
- Progress and upcoming in two columns at 768px when content fits; otherwise stack.
- My Courses becomes a two-column object grid or full-width rows.

### Mobile anatomy

```text
Top product bar
Greeting and notification action
Continue Learning
Next session
Progress summary
My courses, horizontal snap only if every card remains fully operable
Resources
Certificates
Mobile navigation
```

- Remove decorative dashboard photography.
- The resume action is visible without horizontal scrolling.
- Course rows keep title, progress, and action within a single understandable object.

### Dashboard states

- No enrollment: replace Continue Learning with catalog entry and explain how to begin.
- Completed all: celebrate factually and prioritize certificate or next available course.
- No session: show a quiet empty state without reserving large blank space.
- Progress failure: retain cached course identity if available and offer retry.
- Permission issue: route to the correct active persona or pending-review state.

## 4. Catalog architecture

### Search and filter model

Desktop:

- Search field is the dominant control.
- Primary quick filters: category, level, and mode.
- Secondary filters: price and sort inside a compact disclosure if space is constrained.
- Active filters appear as removable tokens with a single Clear All action.
- Result count and sort sit above results.

Mobile:

- Search remains inline.
- One Filters button opens a full-height drawer.
- Drawer groups options by Category, Level, Mode, and Price, shows result count, and has Apply and Reset actions.
- Applied filters remain visible above results.

### Course-card comparison contract

Always show:

- Title
- Category or skill
- Level
- Duration
- Instructor
- Price or Free

Show when supported:

- Certificate availability
- Mode and next start date
- Enrollment progress and Continue action for enrolled users

Do not show:

- Decorative featured labels without ranking meaning
- Multiple overlapping badges on photography
- Invented rating, learner count, or popularity

### Course detail conversion path

1. Title, short outcome, level, mode, duration, instructor.
2. Primary state-aware action: Enroll, Buy, Continue, or Completed.
3. What you will learn.
4. Curriculum preview with duration and access state.
5. Instructor information already present in data.
6. Certificate and resource details.
7. Payment/access clarification and provider failure state.

The enrollment summary stays visible on desktop and becomes a bottom decision bar on mobile only if it does not cover content or accessibility controls.

## 5. Course-player architecture

Replace the current all-lessons-on-one-page model with one active lesson workspace while preserving routes and progress services.

### Desktop anatomy

```text
Course top bar: back to dashboard, course title, overall progress
Curriculum rail | Active lesson header
                | Video, document, or text content
                | Transcript/captions when available
                | Resources and notes tabs
                | Completion action and Previous/Next
```

- Curriculum rail is 280 to 320px, collapsible, and independently scrollable.
- Modules disclose lessons. Current, complete, locked, and unavailable states are explicit.
- Active lesson content uses a 680 to 860px readable/content width.
- Video preserves aspect ratio and reserves size before provider load.
- Resume restores watched position where the provider and current service support it.
- Mark Complete reflects the actual progress API result and is never optimistic without recovery.
- Previous and Next include lesson titles where space permits.

### Tablet

- Curriculum becomes a 240px compact rail at 1024px.
- At 768px it becomes a drawer opened by a persistent Curriculum button.
- Lesson actions remain within thumb reach and do not depend on hover.

### Mobile

- Product top bar, course progress, active lesson, content, resources/transcript accordions, and sticky previous/next controls.
- Curriculum opens as a full-height drawer and returns focus to the trigger.
- Media controls remain provider-native where possible.
- No sideways scroll except within intentionally scrollable transcript timestamps or code content.

### Course-player states

- Loading: curriculum and player skeletons with reserved media ratio.
- Provider unavailable: retain lesson metadata, transcript, documents, and retry.
- Unauthorized: explain access and return to course detail or support.
- Offline-like failure: retain downloaded/static content where available and offer retry for progress sync.
- No media: present the text/document lesson as the primary format, not as an empty video box.
- Completion success: confirm saved progress and offer next lesson.
- Final lesson: provide course completion and certificate state based on real data.

Notes are included only if existing architecture gains persistent note storage through a separately approved feature. Do not ship a local-only notes control that implies durable saving.

## 6. Auth and onboarding architecture

Use one calm split layout on desktop and a single-column flow on mobile. Keep institutional reassurance concise and place the form first in mobile reading order.

### Flow

1. Login or registration.
2. Google or email/password method.
3. Required profile completion.
4. Email or WhatsApp verification channel.
5. OTP verification with expiry, resend, paste, and alternate-channel behavior.
6. Persona membership resolution.
7. Active portal, pending review, or invitation destination.

### Rules

- Show progress text such as Account, Profile, Verification only during multi-step onboarding, not during simple login.
- Explain that selected persona intent may require approval and does not grant access by itself.
- Preserve the safe intended destination across all steps.
- Google failure offers email login without losing context.
- WhatsApp provider failure offers email when allowed.
- Recovery uses the same OTP and message patterns.
- Error messages are specific, localized, and do not reveal account existence where security policy forbids it.

## 7. Persona information priorities

### Student

Continue learning, next session, progress, courses, resources, certificates, profile.

### Parent

Linked child selector, current learning status, next session/action, recent progress, shared resources, contact/support. Do not expose educational or personal data beyond the relationship permission model.

### AVS

Assigned learners, today's appointments, overdue follow-up, recent case activity, approved resources, public profile status. Avoid dashboard analytics that do not support daily work.

### Teacher

Today's teaching schedule, cohorts, learners needing attention, assessment/task queue, content/resources. Do not reuse student course cards as cohort management cards.

### Specialist

Assigned cases, appointments, requested assessments or follow-up, shared resources, recent relevant activity. Sensitive information requires explicit server-side authorization and careful compact display.

### Admin

Operational exceptions first, then verified metrics, queues, recent system activity, and navigation to detailed workspaces. Admin is not a learner dashboard with more numbers.

## 8. Responsive strategy

Validation widths: 375, 768, 1024, 1280, and 1440px.

- 375px: strict single-column priority flow, 20px gutters, 44px targets, mobile drawers, no clipped controls.
- 768px: tablet composition chosen deliberately per route, not a shrunken desktop.
- 1024px: shell transitions and navigation fit are the primary checks.
- 1280px: default desktop grid and content hierarchy.
- 1440px: cap line lengths and prevent empty-space drift.

Tables choose between priority columns plus details, stacked records, and contained horizontal scrolling per workflow. Filters use a drawer on mobile. Course and resource lists may scroll horizontally only when cards remain complete and keyboard navigation is usable.

## 9. RTL strategy

1. Maintain document-level `lang` and `dir` from the route locale.
2. Convert physical CSS properties and transforms to logical equivalents.
3. Mirror shell rail, drawers, breadcrumb direction, chevrons, previous/next layout, and directional transitions.
4. Keep media, progress values, certificate codes, emails, URLs, and phone numbers correctly isolated.
5. Review Arabic labels independently. Do not translate French string lengths mechanically into fixed control widths.
6. Verify keyboard focus follows meaningful DOM order after visual reversal.
7. Test tables, filter drawers, dialogs, curriculum, course navigation, OTP inputs, and pagination in Arabic, not only page headings.

## 10. Accessibility rules

- WCAG 2.2 AA is the release threshold.
- One page heading, semantic landmarks, and descriptive navigation labels.
- Visible focus in all three shells.
- Keyboard access to menus, drawers, filters, curriculum, dialogs, media alternatives, and tables.
- Touch targets approximately 44px.
- Errors connected to fields and summarized when multiple fields fail.
- Progress exposes value, minimum, and maximum to assistive technology.
- Status never relies on color alone.
- Reduced motion removes spatial transitions.
- Meaningful images have localized alt text; decorative images use empty alt text.
- Dialog and drawer focus management is tested, including return focus.
- No page-level horizontal overflow at the five required widths.

## 11. Motion strategy

- 120ms for hover and pressed feedback.
- 180ms for menus, accordion disclosure, and progress state.
- 240ms maximum for drawers and dialogs.
- Use opacity and transform. Avoid width, height, left, and right animation.
- No decorative scroll reveal, parallax, marquee, or continuous motion.
- Every animation must communicate hierarchy, feedback, or a state transition.
- Respect reduced motion and never delay access to learning content.

## 12. Implementation order

### Phase 0: protect behavior and measure baseline

- Record route screenshots and keyboard behavior in French and Arabic.
- Capture current analytics event names, URLs, query parameters, and authorization checks.
- Create targeted visual and interaction regression coverage.
- Confirm approved logo asset and Arabic font files.

Exit: baseline evidence exists; no redesign code yet.

### Phase 1: token and primitive consolidation

- Split global CSS into tokens, reset, primitives, public, product, and admin layers.
- Implement semantic colors, type, spacing, radius, elevation, focus, and motion tokens.
- Consolidate Button, Input, Select, Badge, Progress, Skeleton, and state components.
- Migrate icons centrally.

Exit: primitives pass contrast, keyboard, FR/AR, RTL, and reduced-motion checks.

### Phase 2: shell separation

- Preserve public shell.
- Introduce ProductShell for student and professional personas.
- Move learner profile and course player out of public header/footer composition.
- Retain AdminShell separately and align it to shared tokens without merging modes.

Exit: each experience has an unmistakable shell and correct server-side routing.

### Phase 3: flagship learner dashboard

- Implement Continue Learning, compact progress, upcoming, courses, resources, certificates, and real notification behavior.
- Remove duplicated KPI weight and decorative competition.
- Complete loading, empty, error, and permission states.

Exit: dashboard answers the next-action question at all validation widths in both locales.

### Phase 4: course player

- Establish one active lesson, curriculum rail/drawer, resume, provider states, resources, completion, and previous/next.
- Preserve playback authorization and progress services.
- Add transcript/captions only where provider data supports them.

Exit: keyboard, mobile, RTL, provider failure, and progress persistence pass targeted tests.

### Phase 5: catalog and course detail

- Build responsive filter bar/drawer and active-filter summary.
- Consolidate card metadata and state-aware actions.
- Recompose course detail conversion path without changing checkout semantics.

Exit: search, filters, pagination, enrollment, payment, and owned states are functional and accessible.

### Phase 6: auth and onboarding

- Unify login, registration, profile completion, verification channel, OTP, recovery, invitation, and pending-review patterns.
- Preserve Better Auth, Google, CSRF/origin checks, safe redirects, rate limiting, and secure cookies.

Exit: every method and provider-failure branch works in FR/AR and keyboard-only use.

### Phase 7: professional persona portals

- Build Parent first where linked-student data exists.
- Build AVS and Specialist assignment workflows from existing query support.
- Build Teacher only as far as cohort/assignment data actually supports.
- Confirm Organization scope before redesigning its information architecture.

Exit: each persona has distinct priorities and no invented actions.

### Phase 8: Admin Console standardization

- Standardize page headers, filters, tables, detail drawers/pages, forms, status, empty/error states, and mobile record behavior.
- Resolve legacy route aliases through documented redirects.
- Review navigation grouping with real task frequency.

Exit: core operational workflows are fast, keyboard-usable, responsive, and visually separate from public/product modes.

### Phase 9: public editorial refinement

- Apply final public composition after product foundations stabilize.
- Preserve route slugs, content voice, SEO metadata, and meaningful local imagery.
- Avoid generic landing-page structures and fabricated social proof.

Exit: public pages are editorial, credible, responsive, and aligned with the same brand tokens.

## 13. Verification per phase

For each major route:

1. Typecheck affected code.
2. Run targeted unit/integration tests.
3. Run the app and inspect at 375, 768, 1024, 1280, and 1440px.
4. Check French LTR and Arabic RTL.
5. Check keyboard order, visible focus, labels, landmarks, and dialogs/drawers.
6. Check loading, empty, error, success, disabled, permission, and provider states.
7. Check browser console and horizontal overflow.
8. Capture desktop and mobile screenshots.
9. Perform strict visual critique and interaction polish.
10. Run broader security and build checks at stable milestones.

## 14. Decision log

- Preserve route structure until migration evidence justifies change.
- Preserve existing server authorization and data contracts.
- Use semantic custom tokens rather than importing a generic product design system.
- Keep Admin Console as a separate enterprise composition.
- Use gold sparingly and cobalt for interaction.
- Remove public chrome from authenticated workspaces.
- Treat the student dashboard and course player as flagship experiences.
- Do not implement notes, recommendations, AI placement, or persona actions without real capability and authorization.

## 15. Readiness verdict

The design direction, route inventory, token strategy, component strategy, flagship learner architecture, catalog, course player, navigation, responsive behavior, RTL contract, accessibility, motion, and implementation order are sufficiently defined to begin phased implementation.

`DESIGN_SYSTEM_READY`
