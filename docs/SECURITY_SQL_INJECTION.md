# SQL injection policy

## Required pattern
Use Drizzle query builder or parameterized `sql` templates. Values from users must remain bound parameters.

Forbidden with untrusted input:
```ts
sql.raw(userInput)
`select * from user where email = '${email}'`
```

Dynamic sorting/filter identifiers must map through a fixed allowlist to schema columns. Never let a request parameter become an SQL identifier directly.

The `security:audit` script flags unreviewed `sql.raw()` calls. A legitimate raw call requires a nearby `SECURITY: sql.raw ...` justification and still may not include untrusted text.

## Verification
Security tests should include apostrophes, SQL metacharacters and common injection-shaped strings and verify they are stored/queried as data. Production database roles should have only the privileges the application needs.
