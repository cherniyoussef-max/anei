# ADR 0002 — Private S3-compatible media
**Status:** accepted

## Context
Paid PDFs/videos cannot live at permanent public URLs or inside horizontally scaled app containers.

## Decision
Use private S3-compatible storage; authorize in ANEI then issue short-lived signed URLs. Direct admin uploads use signed PUT URLs.

## Consequences
App remains stateless and media scales independently. Production requires storage credentials/bucket policy and later malware/transcoding workers.
