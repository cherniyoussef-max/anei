# Privacy and data lifecycle

This is an engineering baseline, not legal advice or a claim of regulatory compliance. ANEI must obtain Tunisia-specific legal/privacy review before launch.

## Data minimization
Store only data required for authentication, learning, payments, certification, support and operations. Do not put secrets, OAuth tokens, session tokens or payment-card data into analytics/audit payloads.

## User export
Authenticated users can export a privacy-safe JSON snapshot of core account, enrollment, purchase/order, webinar and certificate records. Provider/session secrets are excluded.

## Deletion/retention
Do not implement irreversible “delete everything” without an academy-approved retention policy. Financial transactions, fraud/audit evidence and issued certificates may have retention requirements that differ from profile data.

Before enabling account deletion, define and document:
1. identity verification/re-authentication;
2. what is deleted vs anonymized vs retained;
3. statutory/contractual retention periods;
4. payment/audit/certificate treatment;
5. backup deletion lifecycle;
6. downstream storage/provider deletion;
7. confirmation and support process.

## Analytics/cookies
Keep nonessential tracking disabled by default until a consent/legal basis decision exists. Authentication/security cookies are operational, not advertising consent signals.

## AVS/contact privacy
Prefer platform-mediated contact. Do not expose private phone/email information simply because an AVS record exists. Define public-field moderation and consent before launch.
