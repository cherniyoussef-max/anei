# ANEI v3.2.5

## Local standalone launcher TypeScript fix

Next.js augments the Node `ProcessEnv` typing so `NODE_ENV` is read-only. The v3.2.4 local launcher assigned directly to `process.env.NODE_ENV`, which caused `next build` to fail during TypeScript validation.

v3.2.5 sets the complete loopback-only smoke environment atomically with `Object.assign(process.env, {...})` before importing `.next/standalone/server.js`.

This is a typing/launcher fix only. Production runtime validation, exact trusted-origin checks, and secure-cookie behavior outside local smoke mode are unchanged.
