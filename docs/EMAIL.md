# Email

Development uses Mailpit (`127.0.0.1:8025` UI, SMTP 1025). Production uses a real authenticated SMTP/provider via server-only environment variables.

Transactional email candidates: verification, reset, enrollment, purchase, webinar reminder and certificate notice. Noncritical email should move to a retryable queue/worker as volume grows.

Rules: no passwords/tokens in logs; no user enumeration through response wording; FR/AR templates; unsubscribe/consent rules for marketing distinct from transactional messages.
