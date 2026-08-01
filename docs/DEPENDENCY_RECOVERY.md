# Dependency recovery (v3.2)

If `npm audit` suddenly reports the old Next.js/Webpack 4 ecosystem, or hundreds of vulnerabilities after a forced audit remediation, the dependency graph has been downgraded or corrupted.

Do not repair that graph package-by-package.

## Clean recovery

```bash
rm -rf node_modules package-lock.json .next
npm cache verify
npm install
npm run deps:check
```

Expected baseline:

- Next.js 16.2.12
- React 19.2.8
- React DOM 19.2.8
- Sharp 0.35.3
- PostCSS 8.5.23
- Drizzle Kit 0.31.10
- ESLint Config Next 16.2.12

The root `package.json` pins Sharp and PostCSS and uses an npm override for PostCSS so Next/Tailwind-related transitive consumers cannot resolve an older vulnerable PostCSS maintenance release.

Never run `npm audit fix --force` on this repository without reviewing the proposed top-level version changes first.

After recovery:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

Development-tool vulnerabilities should be reviewed separately from production runtime vulnerabilities.
