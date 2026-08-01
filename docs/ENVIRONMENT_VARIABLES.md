# Environment variables

`.env.example` is the canonical development template. Real secrets belong in a deployment secret manager, never Git. The table below shows **formats**, not usable credentials.

| Name | Required? | Environment | Secret? | Purpose | Example format |
|---|---|---|---:|---|---|
| `APP_URL` | yes | all | no | Canonical application origin. HTTPS in production. | `https://academy.example.tn` |
| `BETTER_AUTH_URL` | yes | all | no | Better Auth origin/callback base. | `https://academy.example.tn` |
| `BETTER_AUTH_SECRET` | yes | all | **yes** | Auth/session cryptographic secret. | random 48+ characters |
| `TRUSTED_ORIGINS` | as needed | all | no | Exact comma-separated browser origins. | `https://academy.example.tn` |
| `TRUST_PROXY_HEADERS` | topology-dependent | staging/prod | no | Trust forwarded client IP only behind a controlled proxy that overwrites headers. | `true` |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | yes in prod | all | no | Require verified email. Production enforces true. | `true` |
| `ENABLE_GOOGLE_AUTH` | optional | all | no | Google OAuth feature flag. | `false` |
| `GOOGLE_CLIENT_ID` | if Google enabled | all | no-ish | OAuth client identifier. | provider value |
| `GOOGLE_CLIENT_SECRET` | if Google enabled | all | **yes** | OAuth client secret. | provider secret |
| `DATABASE_URL` | yes | all | **yes** | PostgreSQL DSN. Production must not use demo credentials. | `postgresql://USER:PASSWORD@HOST:5432/DB` |
| `DB_POOL_MAX` | yes | all | no | Max DB connections per web replica. | `10` |
| `REDIS_URL` | recommended | all | **yes** | Distributed rate-limit/cache/queue endpoint. | `rediss://USER:PASSWORD@HOST:6379` |
| `SMTP_HOST` | yes for auth email | all | no | SMTP/provider host. Production rejects localhost. | `smtp.provider.example` |
| `SMTP_PORT` | yes | all | no | SMTP port. | `587` |
| `SMTP_SECURE` | yes | all | no | Direct TLS mode (`true` commonly for 465). | `false` |
| `SMTP_USER` | provider-dependent | staging/prod | **yes** | SMTP username. | provider value |
| `SMTP_PASS` | provider-dependent | staging/prod | **yes** | SMTP password/API credential. | provider secret |
| `SMTP_FROM` | yes in prod | all | no | Verified sender identity. `.local` rejected in production. | `ANEI <no-reply@example.tn>` |
| `CONTACT_EMAIL` | yes in prod | all | no | Public/support destination. `.local` rejected in production. | `contact@example.tn` |
| `CONTACT_PHONE` | optional | all | no | Approved academy phone. | `+216 ...` |
| `CONTACT_ADDRESS` | yes when published | all | no | Approved academy address text. | academy-approved value |
| `SECURITY_CONTACT_EMAIL` | recommended | staging/prod | no | Security disclosure contact/security.txt. | `security@example.tn` |
| `LOG_LEVEL` | yes | all | no | Structured server log threshold. | `info` |
| `ENABLE_FLOUCI` | optional | all | no | Flouci feature flag. | `false` |
| `FLOUCI_PUBLIC_KEY` | if enabled | staging/prod | **yes** | Merchant credential. | provider value |
| `FLOUCI_PRIVATE_KEY` | if enabled | staging/prod | **yes** | Merchant private credential. | provider secret |
| `FLOUCI_BASE_URL` | if enabled | staging/prod | no | Verified provider API origin. | official provider URL |
| `FLOUCI_ACCEPT_CARD` | optional | staging/prod | no | Provider checkout option if supported/configured. | `true` |
| `PAYMENT_DEFAULT_PROVIDER` | yes | all | no | Active provider. `mock` is forbidden in production. | `flouci` |
| `PAYMENT_ALLOW_MOCK` | dev/test only | dev/test | no | Enables local mock checkout. | `true` |
| `ENABLE_CLICTOPAY` | no until certified | all | no | Must stay false until merchant-specific implementation/acceptance. | `false` |
| `CLICKTOPAY_*` | later | staging/prod | mixed | Official merchant configuration only. | provider-supplied |
| `STORAGE_PROVIDER` | yes | all | no | `local` dev or `s3-compatible` production. | `s3-compatible` |
| `STORAGE_BUCKET` | if S3 | staging/prod | no | Private bucket name. | `anei-private` |
| `STORAGE_ENDPOINT` | provider-dependent | staging/prod | no | R2/MinIO/custom S3 endpoint; blank for AWS S3. | `https://...` |
| `STORAGE_REGION` | if S3 | staging/prod | no | Signing region. | `eu-west-1` |
| `STORAGE_FORCE_PATH_STYLE` | provider-dependent | staging/prod | no | Compatibility switch. | `false` |
| `STORAGE_ACCESS_KEY_ID` | if static credentials used | staging/prod | **yes** | Object-store credential. Prefer workload identity where available. | provider value |
| `STORAGE_SECRET_ACCESS_KEY` | if static credentials used | staging/prod | **yes** | Object-store secret. | provider secret |
| `STORAGE_DOWNLOAD_URL_TTL_SECONDS` | yes | all | no | Protected resource signed-GET lifetime. | `300` |
| `STORAGE_MEDIA_URL_TTL_SECONDS` | yes | all | no | Enrolled lesson-media signed-GET lifetime. | `7200` |
| `ENABLE_AI` | no initially | all | no | AI rollout flag. Production currently fails closed when true. | `false` |
| `ENABLE_ADMIN_MFA` | no until implementation | all | no | MFA rollout flag. Production currently fails closed when true. | `false` |
| `SEED_DEMO_DATA` | dev/test only | dev/test | no | Enables demo seed outside production. Production rejects true. | `true` |

## One-time privileged bootstrap
These are command-only values for `npm run db:bootstrap-admin`, then they should be removed from the shell/job:

| Name | Required | Secret? | Purpose |
|---|---:|---:|---|
| `BOOTSTRAP_ADMIN_EMAIL` | yes | no | Initial SUPER_ADMIN email. |
| `BOOTSTRAP_ADMIN_PASSWORD` | yes | **yes** | Strong initial credential; never commit/log it. |
| `BOOTSTRAP_ADMIN_NAME` | optional | no | Display name. |

## Destructive local reset
`ALLOW_DB_RESET=true` is accepted only when `NODE_ENV` is not production **and** the configured PostgreSQL host is localhost/loopback. After reset use `npm run db:migrate`, never `db:push` as a production workflow.
