# Dependency and supply-chain security

## Policy
- Commit `package-lock.json` and use `npm ci` in CI/release jobs.
- Review `npm audit` findings; never apply `npm audit fix --force` blindly.
- Dependabot monitors npm and GitHub Actions dependencies.
- CodeQL performs static analysis on pull requests/main and on schedule.
- Generate/review an SBOM as part of a mature release process before production launch.
- Prefer maintained dependencies and remove packages that duplicate native/framework capabilities.

## Release gate
A release is blocked when a runtime vulnerability has a credible attack path and a supported fix is available. Dev-only findings are triaged by exploitability and CI exposure rather than ignored automatically.

## Secret and container scanning
Production CI should add organization-approved secret scanning and container scanning (for example Gitleaks and Trivy) once the repository is hosted in its deployment environment. These tools must scan only this owned repository/images.

## Current environment limitation
The hardening workspace could not reach the npm registry reliably, so dependency installation/audit/build results must be regenerated in a registry-connected checkout. This document does not claim an audit result that was not executed.
