---
name: anei-ui-performance
description: Audit and optimize ANIE frontend performance without degrading UX, accessibility, architecture, or maintainability.
---

# ANIE UI Performance

Measure before optimizing.

Inspect:

- Next.js build output
- client bundle boundaries
- unnecessary client components
- hydration
- route waterfalls
- duplicated fetches
- images
- fonts
- layout shift
- large third-party dependencies
- slow rendering
- skeleton strategy
- caching
- pagination
- N+1 requests

Prioritize user-perceived performance.

Focus on:

fast initial shell
stable layout
fast navigation
immediate interaction feedback
progressive data loading

Avoid premature micro-optimization.

Prefer:

server components where appropriate
small client islands
optimized images
font subsetting/loading
stable dimensions
streaming/suspense where valuable
prefetch only where useful

Do not sacrifice accessibility for performance.

Return:

measured issue
user impact
root cause
change
before/after evidence
remaining debt
