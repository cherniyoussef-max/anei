# Apply ANEI v3.3.0 redesign patch

Apply the patch over a clean/working v3.2.6 source tree:

```bash
unzip -o anei-v3.2.6-to-v3.3.0-ui-redesign.zip -d .
rm -rf .next
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run security:audit
npm run build
npm run check
```

Then run the local production smoke server:

```bash
npm run start:local
```

Visual QA should cover FR and Arabic RTL on mobile/tablet/desktop before deployment.
