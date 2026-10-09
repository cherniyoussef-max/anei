# Testing Patterns

**Analysis Date:** 2026-10-09

## Test Framework

**Runner:**
- Node.js native test runner (`node:test`) executed via `tsx --conditions=react-server --test`.
- Playwright Test Runner for browser end-to-end automation (`@playwright/test`).

**Run Commands:**
```bash
npm run test           # Run all unit and security regression test suites
npm run test:unit      # Run domain unit tests (tests/unit/**/*.test.ts)
npm run test:security  # Run security regression tests (tests/security/**/*.test.ts)
npm run test:e2e       # Run Playwright E2E browser tests
npm run test:e2e:headed# Run Playwright with visible browser UI
npm run check          # Full gate: typecheck, lint, test, security:audit, build
```

## Test File Organization

**Location:**
- Test files reside in dedicated top-level directories:
  - `tests/unit/`: Domain logic, services, utilities, and query contracts.
  - `tests/security/`: Origin checks, rate limiting, token rotation, authentication regression suites.
  - `tests/integration/`: Cross-boundary service workflows and webhooks.
  - `tests/e2e/`: User flow validation using headless Chromium.
  - `tests/load/`: Performance benchmarking via k6.

## Test Structure

**Suite Pattern (`node:test` + `node:assert/strict`):**
```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("unit: assessment submission calculates score correctly", async () => {
  // 1. Arrange test data
  const answers = { q1: "option_a", q2: "option_c" };

  // 2. Act
  const result = scoreAssessment(answers, rubric);

  // 3. Assert
  assert.equal(result.scorePercent, 100);
  assert.equal(result.passed, true);
});
```

## Mocking & Isolation

**Patterns:**
- No heavyweight global monkey-patching frameworks.
- In-memory mock providers for third-party services:
  - `src/server/payments/mock.ts` for payment flows in test environments.
  - In-memory store fallback when Redis is absent in test runners.
  - Mock fetch / response stubs for external webhook assertions.

## Test Types

**1. Security Regressions (`tests/security/`):**
- Tests verify fail-closed behavior for unauthenticated calls, origin checking on mutating routes, and HMAC constant-time comparisons.
- Verifies that production environments strictly disallow mock payment flags or demo seeding.

**2. Domain Unit Tests (`tests/unit/`):**
- Tests verify business calculations: course progress percentages, certificate code generators, phone normalization, date formatting.

**3. Browser E2E Tests (`tests/e2e/`):**
- Playwright tests verify actual user interaction: login modal, course navigation, quiz completion, certificate display.

---

*Testing analysis: 2026-10-09*
