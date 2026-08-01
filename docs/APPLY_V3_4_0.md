# Apply ANEI v3.4.0

## Recommended: patch an already working v3.3.0 checkout

This preserves your local `.env`, generated `package-lock.json`, installed dependencies and Docker data.

```bash
cd ~/Desktop/anei-platform-production-v3.3.0
unzip -o ~/Downloads/anei-v3.3.0-to-v3.4.0-human-redesign.zip -d .
grep '"version"' package.json | head
rm -rf .next
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run security:audit
npm run build
npm run check
npm run start:local
```

Expected package version: `3.4.0`.

## Full archive

If using the full v3.4.0 archive as a new checkout, copy your existing `.env` and `package-lock.json` from the already validated local v3.3.0 project before running `npm ci`:

```bash
cp ~/Desktop/anei-platform-production-v3.3.0/.env .env
cp ~/Desktop/anei-platform-production-v3.3.0/package-lock.json package-lock.json
npm ci
```

The redesign changes no dependency versions, so the validated v3.3.0 lockfile remains compatible with the package manifest apart from the root package version metadata.
