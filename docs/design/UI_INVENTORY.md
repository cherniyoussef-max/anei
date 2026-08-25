# ANEI UI Inventory

Status: discovery baseline  
Source reviewed: current route tree, shared layouts, global styles, auth components, learner dashboard, course player, persona shells, Admin Console shell, and three design references.

## 1. Current architecture summary

ANEI currently uses Next.js App Router with locale-prefixed French and Arabic routes. The document root correctly derives `lang` and `dir` from the locale. The application has a public site shell, a learner dashboard assembled directly in its page, a shared minimal persona shell, and a separate Admin Console shell.

The visual layer is concentrated in one large `src/app/globals.css` file. It contains at least three successive root-token definitions and multiple generations of component overrides. This makes the rendered source of truth difficult to identify and is the primary design-system risk.

## 2. Route inventory by persona

Legend:

- Public: no authenticated product context required.
- Shared auth: used by more than one persona before routing.
- Protected: server session or persona authorization required.
- Operational: Admin Console workflow.

### PUBLIC

| Route | Purpose | Current shell | Design disposition |
| --- | --- | --- | --- |
| `/{locale}` | Institutional homepage and discovery | Public header/footer | Preserve route; editorial redesign |
| `/{locale}/about` | Institution, mission, values | Public header/footer | Preserve route and content hierarchy |
| `/{locale}/formations` | Course catalog | Public header/footer | Recompose search/filter/results |
| `/{locale}/formations/{slug}` | Course detail and enrollment | Public header/footer | Strengthen conversion and curriculum preview |
| `/{locale}/webinaires` | Webinar catalog | Public header/footer | Preserve inventory; improve date/status scan |
| `/{locale}/bibliotheque` | Paid/free resources | Public header/footer | Clarify access, price, and download ownership |
| `/{locale}/avs` | Public AVS directory | Public header/footer | Preserve verified status and search |
| `/{locale}/actualites` | News index | Public header/footer | Editorial list treatment |
| `/{locale}/actualites/{id}` | News detail | Public header/footer | Reading layout |
| `/{locale}/contact` | Contact | Public header/footer | Keep functional form and response states |
| `/{locale}/certificats/{code}` | Owned certificate view | Public visual shell, protected data | Move toward print/product utility treatment |
| `/{locale}/confidentialite` | Privacy | Public header/footer | Reading layout |
| `/{locale}/conditions` | Terms | Public header/footer | Reading layout |

### SHARED AUTH AND ONBOARDING

| Route | Purpose | Current state | Required coherent flow |
| --- | --- | --- | --- |
| `/{locale}/login` | Email/password and Google sign-in | Functional split auth layout | Entry point |
| `/{locale}/register` | Account and persona intent | Functional form | Account creation |
| `/{locale}/complete-profile` | Required profile fields | New protected step | Profile completion |
| `/{locale}/verification-channel` | Choose email or WhatsApp OTP | New protected step | Channel selection |
| `/{locale}/forgot-password` | Recovery initiation | Functional form | Recovery request |
| `/{locale}/reset-password` | OTP/password completion | Functional form | Recovery completion |
| `/{locale}/invitation/{token}` | Invitation claim | Functional card flow | Organization/persona invitation |
| `/{locale}/pending-review` | Persona approval wait | Static status page | Explain status and next step |
| `/{locale}/paiement/succes` | Payment success | Status page | Confirm ownership and next action |
| `/{locale}/paiement/echec` | Payment failure | Status page | Recovery and support |
| `/{locale}/paiement/mock` | Development-only payment | Utility | Exclude from production navigation |

Coherent auth sequence:

`Sign in or register -> complete required profile -> choose verification channel -> verify OTP -> resolve active persona -> destination portal`

Returning users should skip completed steps. Provider errors must preserve the intended destination and offer email/password fallback.

### STUDENT

| Route | Purpose | Current shell | Priority |
| --- | --- | --- | --- |
| `/{locale}/dashboard` | Continue learning, progress, sessions, resources, certificates | Bespoke sidebar inside public layout | Flagship redesign |
| `/{locale}/dashboard/profil` | Profile, connected accounts, sessions, security | Public layout | Move into learner shell |
| `/{locale}/apprendre/{slug}` | Full course curriculum and lesson content | Public layout with long page | Flagship redesign |

### PARENT

| Route | Purpose | Current maturity | Required priority |
| --- | --- | --- | --- |
| `/{locale}/parent` | Linked children and support context | Minimal list/empty copy | Child status, next support action, sessions, resources, contact |

### AVS

| Route | Purpose | Current maturity | Required priority |
| --- | --- | --- | --- |
| `/{locale}/avs/espace` | Assigned learners and professional workspace | Minimal list/empty copy | Assigned learners, appointments, follow-up actions, resources, public profile |

### TEACHER

| Route | Purpose | Current maturity | Required priority |
| --- | --- | --- | --- |
| `/{locale}/teacher` | Cohorts and learner progress | Coming-soon copy | Cohorts, upcoming sessions, learner exceptions, teaching resources |

### SPECIALIST

| Route | Purpose | Current maturity | Required priority |
| --- | --- | --- | --- |
| `/{locale}/specialist` | Assigned learners and specialist follow-up | Minimal list/empty copy | Assigned cases, appointments, requested actions, shared resources |

### ORGANIZATION

The codebase also contains `/{locale}/organization`, although the requested persona taxonomy does not list Organization separately. Treat it as an institutional account context, not as Admin Console. Its information architecture requires confirmation during implementation planning: members, invitations, enrollments, and organization profile are likely priorities, but no new capabilities should be invented.

### ADMIN

Admin uses a dedicated shell and server-enforced authorization. Current route groups:

| Group | Routes |
| --- | --- |
| Overview | `/admin` |
| Identity | `/admin/users`, `/admin/users/{id}`, legacy `/admin/utilisateurs` |
| Learning | `/admin/learning`, `/admin/courses`, `/admin/enrollments`, `/admin/certificates` |
| Content | `/admin/webinars`, `/admin/resources`, `/admin/news` |
| Organizations | `/admin/organizations`, `/admin/organizations/{id}`, `/admin/relationships` |
| Commerce | `/admin/orders`, legacy `/admin/commandes`, `/admin/payments` |
| Communication | `/admin/contacts` |
| Governance | `/admin/audit`, `/admin/system` |
| CRM index | `/admin/crm` |
| CRM workspace | `/admin/crm/{orgId}` |
| CRM contacts | `/admin/crm/{orgId}/contacts/{contactId}` |
| CRM admissions | `/admin/crm/{orgId}/admissions`, detail route |
| CRM appointments | `/admin/crm/{orgId}/appointments`, detail route |
| CRM assessments | `/admin/crm/{orgId}/assessments`, detail route |
| CRM cohorts | `/admin/crm/{orgId}/cohorts`, detail route |
| CRM pipeline | `/admin/crm/{orgId}/pipelines` |
| CRM WhatsApp | `/admin/crm/{orgId}/whatsapp` |

Legacy French/English duplicate route labels should be resolved without silently breaking URLs. Choose one canonical route and preserve redirects after analytics and external-link review.

## 3. Shared components found

### Reuse with design-system alignment

- `SiteHeader`: keep behavior, locale switch, account behavior, search route, and mobile separation.
- `SiteFooter`: keep legal, learning, academy, contact, and newsletter content.
- `LocaleSwitcher`: keep locale semantics and route preservation.
- `MobileMenu`: keep authentication-aware behavior; redesign as accessible drawer.
- `AccountActions`: keep session behavior and destinations.
- `PageHero`: reuse for secondary public pages after reducing repetitive hero treatment.
- `SectionHeading`: retain semantic API; remove forced eyebrow usage.
- `Pagination`: keep query preservation and locale behavior.
- `CourseFilter`: preserve server query parameters and filtering behavior.
- `ResourceCatalog`: preserve payment/download capabilities.
- `AuthForm`: preserve Better Auth, Google, redirect, and error behavior.
- `PasswordRecoveryForm`, `ResetPasswordForm`, `CompleteProfileForm`, `VerificationChannelForm`, `InvitationClaimFlow`: preserve domain flow and validation.
- `VideoLessonPlayer`, `YoutubeLessonPlayer`, `StreamLessonPlayer`: preserve provider behavior, playback authorization, and progress APIs.
- `PersonaPortalShell`: preserve role separation and server-authorized destinations.
- `AdminShell`, `AdminPageHeader`, `AdminCharts`, `AdminMetricWorkspace`: preserve dedicated admin mode and data semantics.

### Refactor centrally

- `globals.css`: split tokens, reset, primitives, public, product, and admin layers. Remove repeated root overrides.
- `Logo`: replace the current provisional abstract mark only when the approved ANEI logo asset is production-ready. Preserve accessible academy label.
- `Icon`: migrate hand-maintained SVG paths to one icon family and provide explicit RTL mirroring rules.
- Button classes: consolidate variants, sizes, loading state, disabled state, focus, and dark-surface behavior.
- Input/select styles: centralize labels, help, error, success, password visibility, and 44px targets.
- Course card variants: converge homepage, catalog, enrollment, and learner-list metadata into one object model with controlled presentations.
- Dashboard panels and lists: replace page-local visual patterns with `Panel`, `ObjectList`, `EmptyState`, and `ErrorState` primitives.
- Admin tables and filters: standardize headers, sorting, pagination, mobile behavior, and bulk actions.

### Create

- `ProductShell`
- `ProductSidebar`
- `ProductTopbar`
- `MobileProductNav`
- `PageHeader`
- `ContinueLearning`
- `ProgressSummary`
- `UpcomingSession`
- `CourseCard`
- `CourseListItem`
- `ResourceListItem`
- `CertificateListItem`
- `CurriculumTree`
- `LessonHeader`
- `LessonActions`
- `TranscriptPanel`
- `ResourcePanel`
- `NotesPanel` only if persistence already exists or is separately approved
- `SearchField`
- `FilterBar`
- `FilterDrawer`
- `Badge`
- `ProgressBar`
- `ProgressRing`
- `Dialog`
- `Drawer`
- `ToastRegion`
- `Skeleton`
- `EmptyState`
- `ErrorState`
- `PermissionState`
- `ProviderUnavailableState`
- `DataTable`
- `MobileRecordList`

## 4. Current UX inconsistencies

### System-level

1. `globals.css` defines conflicting token sets multiple times. Early values are green/teal and heavily rounded, later values are cobalt/slate, and final overrides move toward navy/cobalt editorial treatment.
2. Component styling is override-driven. The same class changes radius, shadow, grid, and color in later sections, which makes regression risk high.
3. The application loads Fraunces globally while the product direction requires careful separation between public editorial display and product UI typography.
4. Current `Icon` and `Logo` components contain hand-maintained SVG paths, conflicting with the preferred single-library icon strategy and approved-brand-asset requirement.
5. Breakpoints repeat with overlapping rules, so a route can receive several different mobile behaviors.
6. State components are inconsistent. Some surfaces have useful empty states, while loading, error, permission, and provider-unavailable patterns vary or are absent.

### Shell and navigation

1. Student, course player, profile, parent, AVS, teacher, specialist, and organization routes live inside the public site layout, so authenticated workspaces inherit the public header and footer.
2. Student has a bespoke sidebar while other personas share a minimal shell, increasing drift.
3. Persona shells reuse the same structural presentation but do not yet express distinct role priorities.
4. Admin separation is materially stronger and should remain independent.

### Student dashboard

Strengths:

- Continue Learning is already first.
- Progress, sessions, resources, and certificates use real data.
- Empty states have meaningful next actions.
- Notifications derive from actual records.

Gaps:

- A decorative dashboard photo competes with the primary next action.
- Four KPI cards repeat information that appears below and create dashboard weight.
- The shell is assembled within the route instead of a reusable product shell.
- Notifications show a count but no defined destination or management surface in the inspected UI.
- Mobile sidebar becomes a grid of links rather than a deliberate learner navigation pattern.

### Course player

Strengths:

- Real providers, protected playback, progress persistence, curriculum grouping, completion state, documents, and previous/next anchors already exist.

Gaps:

- Every lesson is rendered down one long page, so the user is not in a focused single-lesson workspace.
- Resume jumps to an anchor rather than restoring a clear active lesson state and exact position.
- Curriculum is not collapsible and is not a mobile drawer.
- Transcript/captions and resource group behavior are not exposed as a coherent secondary panel.
- Provider loading and authorization errors exist inside players, but retry, unavailable, and offline-style messaging are inconsistent.
- Previous/next arrow placement and mirroring need explicit RTL rules.

### Catalog and course detail

Strengths:

- Search, category, level, mode, price, sort, server pagination, instructor, duration, start date, and pricing are supported.
- Course cards use real catalog data and local imagery.

Gaps:

- Six simultaneous controls plus apply/reset create a dense desktop toolbar and an overly long mobile form.
- Filter selections are not summarized as removable active filters.
- Cards do not currently receive enrollment/progress state in the inspected catalog contract.
- Certificate availability is not surfaced for comparison.
- Image overlays and featured markers add more visual badges than needed.
- The detail conversion path needs a stable enrollment summary, clearer outcomes, curriculum preview, and owned/enrolled states.

### Auth and onboarding

Strengths:

- Email/password, Google, profile intent, profile completion, email or WhatsApp assurance, password recovery, invitation, and safe redirect handling exist.

Gaps:

- These pages are visually related but not presented as one visible sequence.
- Google unavailability is explanatory but the complete provider-failure recovery hierarchy is not standardized.
- OTP paste, resend, expiry, alternative channel, and lockout presentation need one shared pattern.
- Profile persona selection occurs during registration but server-authoritative review/activation determines the destination. The UI must explain this distinction.

### Persona portals

- Parent currently exposes a plain linked-child list or support message.
- AVS and Specialist currently expose plain assigned-student lists.
- Teacher currently exposes only coming-soon content.
- Shared shell navigation exists, but each persona lacks a complete task hierarchy and state model.
- These are foundations, not mature dashboards. Their roadmap must be evidence-led and must not invent backend capabilities.

### Admin Console

Strengths:

- Dedicated responsive shell, grouped navigation, active state, mobile drawer, locale switch, real route breadth, and server authorization are present.

Gaps:

- Navigation is long and may exceed comfortable scan depth.
- Legacy duplicate routes increase information architecture ambiguity.
- Admin component styling remains in the same large global stylesheet as public and learner surfaces.
- Mobile tables require route-specific priority decisions rather than a universal horizontal scroll fallback.
- Filters, forms, data tables, detail pages, charts, and status badges need one enterprise component contract.

## 5. State coverage matrix

Every data surface must support the following contract:

| State | Required behavior |
| --- | --- |
| Loading | Shape-matched skeleton; preserve layout; announce only when delay is meaningful |
| Empty | Explain cause; one valid next action; no decorative dead-end illustration required |
| Error | Scope-specific message; retry; preserve user input; support path where needed |
| Success | Confirm completed action and resulting ownership/status |
| Disabled | Explain prerequisite when not obvious |
| Permission denied | Name the missing access category; do not imply missing content |
| Provider unavailable | Name affected capability and fallback without internal details |
| Offline-like failure | Preserve content already loaded; retry connection-dependent action |

## 6. Inventory verdict

The codebase has substantial real functionality and enough shared foundations to support a premium redesign without changing backend semantics. The design work should consolidate rather than replace: preserve routes, authorization, query contracts, progress, payments, and provider behavior; replace the fragmented style source of truth and authenticated shell composition.
