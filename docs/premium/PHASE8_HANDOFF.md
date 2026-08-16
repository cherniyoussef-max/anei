# Phase 8 Handoff — Cloudflare Stream + Private Video Authorization

## Scope implemented

- `lessons.mediaProvider` (`internal`/`youtube`/`cloudflare_stream`, default `internal`) + `lessons.mediaRef` (additive columns).
- YouTube support for public/preview lessons: canonical video id extraction/validation, no-cookie embed, enforced server-side to `preview = true` lessons only.
- Cloudflare Stream support for private/paid lessons: short-lived signed playback token requested server-side, only after the existing Phase 7 enrollment entitlement check.
- `getLessonForPlayback(userId, lessonId)` — the single authoritative playback-authorization query, resolving course/enrollment from `lessonId` alone.
- `POST /api/lessons/[id]/playback` — issues a Cloudflare Stream playback token for an entitled, authenticated caller.
- Admin lesson media configuration: `POST /api/admin/lessons` extended, new `PATCH /api/admin/lessons/[id]` for editing existing lessons (including converting legacy lessons to a new provider).
- Course player (`/apprendre/[slug]`) and public course page (`/formations/[slug]`) branch on `mediaProvider`.

## Provider architecture

- `src/server/media/youtube.ts` — `canonicalYoutubeId()` accepts a bare 11-char id or `youtube.com`/`youtu.be` URL forms only; rejects everything else (`javascript:`, unrelated origins, raw HTML). `youtubeEmbedUrl()` builds a `youtube-nocookie.com/embed/<id>` URL.
- `src/server/media/cloudflare-stream.ts` — `getStreamPlayback(videoUid)` calls Cloudflare's `POST /accounts/{account}/stream/{uid}/token` endpoint. This delegates JWT signing to Cloudflare entirely: **no PEM/JWK signing key is generated, stored, or handled by ANEI**, avoiding the higher-risk signing-key-management path Cloudflare's docs also offer. Reuses `STORAGE_MEDIA_URL_TTL_SECONDS` (existing config, 300s–14400s, default 7200s) as the token `exp`, rather than inventing a second TTL knob for the same "how long can a viewer keep watching" concern `signedMediaUrl()` already governs.
- No shared `VideoPlaybackProvider` interface was introduced — YouTube needs no server call (client embeds the already-delivered `mediaRef` directly) and Cloudflare Stream is the only provider needing a playback endpoint, so a generic interface would have been an unused abstraction.
- `src/server/services/lesson-media.ts` — `resolveMediaRef(provider, mediaRef, preview)` is the one place cross-field validation lives (YouTube requires `preview = true`), shared by lesson create and lesson update so the rule can't drift between the two routes.

## Lesson/media model

`lessons.mediaProvider` (`internal` default) + `lessons.mediaRef` (nullable), both additive, both DB-constrained (`lessons_media_provider_check`). `videoUrl`/`documentUrl` keep their exact existing meaning and are untouched for `internal` lessons.

## Legacy compatibility

Every existing lesson defaults to `mediaProvider = 'internal'`; `getLearningCourse`, `getPublishedCourse`, `VideoLessonPlayer`, and `signedMediaUrl()` are **not modified** and continue to serve `internal` lessons exactly as before Phase 7. Migration is additive-only (`drizzle/0012_lesson_media_provider.sql`), verified applied against the local dev DB; migrations 0000–0011 are unchanged (`git diff --stat -- drizzle/` empty for existing files).

## Private playback authorization

`getSession()` → `lessonId` (only client input, UUID-validated) → `getLessonForPlayback(session.user.id, lessonId)` (resolves course/enrollment server-side, same enrollment-row-presence check as `getLearningCourse`/`hasEntitlement`, source-agnostic) → provider/mediaRef check → `getStreamPlayback()`. No entitlement → 403, before the Cloudflare API is ever called (test-proven, source-inspection). userId always comes from session; lessonId cannot be swapped for another course's lesson to gain entitlement (test-proven, real-DB IDOR test).

## Cache/security decisions

- Playback route: `Cache-Control: private, no-store` on every response branch (401/403/400/502/503/200) — a shared `noStore` header constant, so no branch can accidentally omit it.
- Rate-limited per authenticated user (`consumeRateLimit("lesson-playback:<userId>", 30, 60)`) before the Cloudflare API call.
- Cloudflare API token/account id never leave the server; provider failures are mapped to bounded error codes (`PROVIDER_NOT_CONFIGURED`, `PLAYBACK_UNAVAILABLE`) — raw fetch/JWT errors are never returned to the client or logged (only a lesson id, on failure).
- Admin media mutations only ever accept a validated provider-native reference (YouTube id / Stream uid), never raw iframe/HTML; audited as `lesson.update` with the new provider and whether the reference changed.

## Config / env

`ENABLE_CLOUDFLARE_STREAM`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE` (all optional/dev-safe; production guard mirrors `ENABLE_WHATSAPP`/`ENABLE_FLOUCI`: enabling without full config throws at boot). `cloudflareStreamConfigured` export fails the feature closed (503) when absent — the rest of the LMS is unaffected.

## Important files

- `src/server/db/schema.ts` (`lessons.mediaProvider`/`mediaRef`)
- `src/server/media/{youtube,cloudflare-stream}.ts`
- `src/server/services/lesson-media.ts`
- `src/server/queries/account.ts` (`getLessonForPlayback`)
- `src/app/api/lessons/[id]/playback/route.ts`
- `src/app/api/admin/lessons/route.ts`, `src/app/api/admin/lessons/[id]/route.ts`
- `src/components/learning/{YoutubeLessonPlayer,StreamLessonPlayer}.tsx`
- `src/app/[locale]/apprendre/[slug]/page.tsx`, `src/app/[locale]/formations/[slug]/page.tsx`

## Migration

`drizzle/0012_lesson_media_provider.sql`, additive (2 columns + 1 check constraint), hand-authored matching the 0001–0011 convention. Applied and verified against the local dev DB.

## Tests / results

- `tests/integration/lesson-media-validation.test.ts` (9/9): YouTube id canonicalization + malicious-URL rejection, Stream uid format bounds, `resolveMediaRef` cross-field rule (YouTube requires preview), fail-closed when Cloudflare Stream is unconfigured.
- `tests/integration/lesson-playback-authorization.test.ts` (7/7, real DB): paid/admin-sourced enrollment grants access (source-parity), no enrollment denied, unauthenticated denied, cross-course IDOR denied, preview lesson entitled without enrollment/session, nonexistent lesson → no leak.
- `tests/unit/lesson-playback-route-contracts.test.ts` (10/10): auth-before-entitlement-before-provider-call ordering, userId always from session, no-store on every response, rate limiting before provider call, no raw provider error leakage, admin routes reject raw HTML/iframe and audit changes.
- Full suite: `test:unit` 159/159, `test:security` 3/3, `test:integration` 159/159 (includes all Phase 1–7 regression suites), all pass.
- `typecheck`: clean. `build`: clean, both new routes listed in output. `deps:check`, `security:audit`: pass.
- `lint`: exactly the 5 pre-existing `no-explicit-any` errors in `src/modules/admin/queries/admin-users.ts` — zero new errors.

## Known debt / deferred

- No admin UI form exists for lessons at all (create is API-only today, predating Phase 8); Phase 8 followed that convention rather than building a first lesson editor UI as an unrelated addition. Media fields are configurable via `POST`/`PATCH /api/admin/lessons`.
- Public catalog page (`/formations/[slug]`) only wires the YouTube preview branch; a `cloudflare_stream` lesson marked `preview = true` renders no preview video there (private Stream playback is intentionally learning-page-only, matching the "protected paid video" product intent — not a crash, just no public preview for that combination).
- `StreamLessonPlayer`'s retry button re-fetches a new token but does not show a "loading" state during retry (cosmetic only).
- No Cloudflare Stream upload/direct-creator-upload flow: admins provide an already-created Stream video UID (YAGNI per Phase 8 scope — matches "admins already obtain Stream video IDs externally").

## Phase 9 boundary

No outbox, worker, retry engine, or webhook processing was added. Cloudflare Stream webhook events (e.g., encoding-complete) are out of scope; Phase 8 assumes the admin supplies an already-ready Stream video UID.
