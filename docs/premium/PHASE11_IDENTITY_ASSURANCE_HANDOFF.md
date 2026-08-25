# PHASE 11 — Identity Assurance, OTP, Google Onboarding, Recovery

## Authentication state machine
- `ANONYMOUS` → `PRIMARY_AUTHENTICATED` (Better Auth session)
- `PRIMARY_AUTHENTICATED` → `PROFILE_REQUIRED` when `user_profile.onboarding_completed_at` is null
- `PRIMARY_AUTHENTICATED`/`PROFILE_REQUIRED` → `OTP_REQUIRED`
- `OTP_REQUIRED` → `FULLY_ASSURED` via `auth_session_assurance`
- `FULLY_ASSURED` → application access

## Session assurance model
- Server-authoritative table: `auth_session_assurance`
- Assurance is bound to `session_id` + `user_id`
- Method allowlist: `EMAIL`, `WHATSAPP`
- New login session requires a new assurance completion

## OTP architecture
- Centralized challenge table: `auth_verification_challenge`
- Server allowlists:
  - channel: `EMAIL`, `WHATSAPP`
  - purpose: `LOGIN`, `PASSWORD_RESET`, `ACCOUNT_RECOVERY`, `VERIFY_EMAIL`, `VERIFY_PHONE`, `CHANGE_EMAIL`, `CHANGE_PHONE`, `SENSITIVE_ACTION`
- Policy:
  - 6-digit OTP
  - expiry 5 minutes
  - max attempts 3
  - resend cooldown 60 seconds
- OTP generation: `crypto.randomInt`
- OTP storage: HMAC hash only (`auth-otp-crypto.ts`), never plaintext

## Email OTP
- Delivery via existing mail infrastructure (`sendMail`)
- No OTP logged in application logs

## WhatsApp OTP
- Reuses existing WhatsApp + outbox worker path
- New helper: `enqueueSystemWhatsAppAuthOtp`
- No direct provider call from auth routes
- Deterministic request id: `otp:<purpose>:<challengeId>:<deliveryVersion>`

## Google onboarding
- One Tap disabled for now
- Standard Google OAuth button remains enabled
- Google post-auth lands on verification flow; profile completion required before assurance
- Account-linking hardening remains:
  - `requireLocalEmailVerified: true`
  - `allowDifferentEmails: false`

## Profile model
- Dedicated `user_profile` table (no static age field)
- Stores profile + onboarding metadata and verified phone timestamp
- Canonical requested persona captured as non-privileged input

## Persona handling
- Persona input is mapped to existing canonical system
- No direct privilege elevation via profile input
- Existing persona membership service remains authoritative

## Password policy
- Centralized server-side minimum set to 15, max 128

## Forgot/reset flow
- Generic forgot response to reduce account enumeration
- OTP verification grants short-lived, single-use reset authorization
- Password reset revokes existing sessions and invalidates prior assurances

## Recovery and change-destination boundaries
- Recovery uses verified channels only
- No security-question fallback
- Change-email/phone hardening remains pending dedicated endpoints

## JWT decision
- Browser remains Better Auth cookie + DB assurance model
- JWT remains deferred (no external consumer introduced in this phase)

## Auth observability
- New structured `auth_event` table
- Safe dimensions only: requestId, userId nullable, provider, channel, purpose, safeReasonCode, metadata
- No OTP/password/token values in event schema

## Rate limits
- Layered OTP limits:
  - per IP
  - per user
  - per challenge cooldown/attempts

## Migrations
- Added: `drizzle/0017_identity_assurance_profile.sql`
- Existing migrations `0000`–`0016` untouched

## Tests added
- Unit: `tests/unit/auth-assurance-contract.test.ts`
- Security: `tests/security/auth-observability.test.ts`
- Integration: `tests/integration/auth-assurance.test.ts`

## Known debt
- Full endpoint-by-endpoint assurance middleware centralization is partial and should be completed.
- Password recovery channel-selection UX is simplified and should be expanded with masked verified destination discovery.
- Full FR/AR polished stepper UX and Playwright onboarding/auth E2E coverage are not complete.
- Some integration tests show intermittent unrelated flakiness in existing invitation coverage.
