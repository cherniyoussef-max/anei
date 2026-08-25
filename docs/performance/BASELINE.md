# ANEI v4 performance baseline

Measured locally on 2026-08-19. Dataset: 2,437 users, 447 enrollments, 3 news posts, and 113 outbox rows. These figures describe this workstation and dataset only.

| Path/query | Measured result | Plan concern | Change/status |
|---|---:|---|---|
| Learner enrollment/course join | 0.113 ms | Uses `enrollment_user_course_unique`; local fixture returned no rows | Explicit projection, 24-row bound, and parallel execution retained |
| Published news list | 0.098 ms | Previously unbounded and selected full article bodies | Explicit card projection and hard limit of 24 |
| Admin user page sample | 1.602 ms | Sequential scan + top-N sort across 2,437 rows; acceptable locally but growth-sensitive | Existing server pagination retained; no speculative index added |
| Production build | 6.7 s compile + 9.9 s TypeScript; 149 static paths generated in 272 ms | Nonce-based CSP keeps rendered application pages dynamic | Optimized production build passes |
| `/api/health` | 0.062 s (production-like warm request) | Local workstation measurement | 200 response |
| `/fr` / `/ar` | 0.114 s / 0.016 s (production-like warm requests) | Local cache and dataset apply | Both 200 responses |
| `/fr/login` / `/ar/login` | 0.084 s / 0.009 s (production-like warm requests) | Local cache and dataset apply | Both 200 responses |

## Query notes

- Learner dashboard now runs four independent bounded queries concurrently. It no longer fetches unused notifications or joins orders for resource purchases. Every query selects only fields rendered by the page: 24 enrollments, 20 resources, 20 certificates, and four future webinars.
- Public news no longer transfers `content_fr`/`content_ar` to the listing page.
- Admin user detail queries are bounded (50–100 rows) and parallel; organization member and several lookup lists remain candidates for cursor or bounded pagination when realistic cardinality warrants UI changes.
- No new index was added: measured local plans are below 2 ms, and the milestone forbids guess-driven indexes.

## Frontend and asset baseline

Measured on the same workstation with the optimized production server:

| Area | Before | After | Result |
|---|---:|---:|---|
| Deployed `public/` assets | about 1.5 MB | 448 KB | About 70% smaller |
| Brand logo | 736,831-byte PNG | 55,580-byte WebP | About 92.5% smaller; source master retained under `docs/design/source-assets/` |
| Duplicate learning images | Three duplicate files (341,672 bytes total) | Canonical copies only | Exact duplicates removed without changing rendered imagery |
| Homepage resource requests, desktop | 34 | 28 | Footer-logo eager load and global navigation prefetch removed |
| Homepage resource requests, 390 px | 24 | 17 | Mobile shell no longer eagerly loads its hidden/secondary brand image |
| Compiled client chunks | — | 47 files / 864,734 bytes (0.82 MB) | No single anomalously large application bundle found; largest chunk about 227 KB |

Warm production browser navigation samples had zero console errors. Desktop routes were generally 66–104 ms for DOM content loaded after warm-up; the 390 px routes were generally 50–154 ms. The first cold desktop homepage load was 500 ms DCL / 997 ms load and includes server and browser cache warm-up. These are local regression numbers, not public-network Core Web Vitals.

The full Playwright suite completed 26/26 workflows in 17.9 seconds against the production server. A prior development-server run took 59.2 seconds; that comparison primarily demonstrates why production mode should be used for normal review, and is not presented as a pure code-only benchmark.

## Measurement boundary

Authenticated learner and third-party provider latency were not converted into synthetic performance claims. The browser authorization paths pass in desktop and mobile Playwright profiles, including FR/AR, RTL, learner, and admin navigation. These local timings are a regression baseline, not a production SLO or field Core Web Vitals report.
