# Database baseline

See [BASELINE.md](./BASELINE.md) for dataset size and route context.

| Query | Before/current | Concern | Change | After |
|---|---:|---|---|---:|
| Published news cards | 0.098 ms | Unbounded full-row read included article bodies | Project card fields and limit to 24 | Same plan retained; transfer and growth are bounded |
| Learner enrollment/course | 1.238 ms | None in actual user predicate; indexed lookup | No index change | 1.238 ms baseline |
| Admin users, 25-row sample | 1.602 ms | Full scan/top-N at 2,437 users | Keep pagination; revisit with production cardinality | 1.602 ms baseline |

Numbers are copied from `EXPLAIN (ANALYZE, BUFFERS)` against the local PostgreSQL container. No fabricated before/after value is presented where the code-level projection does not alter the SQL plan materially.
