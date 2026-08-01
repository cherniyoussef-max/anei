# Media and protected files

Development can use `/public/demo`. Production protected files use private S3-compatible storage.

## Download
`session -> purchase/enrollment authorization -> short-lived signed GET URL -> object storage/CDN`.
Permanent public URLs for purchased content are forbidden.

## Upload
`POST /api/admin/storage/presign-upload` requires ADMIN, trusted origin, rate limit, allowed MIME and size. It returns a random object key and short-lived presigned POST policy. Upload directly to object storage rather than proxying large files through Next.js.

Allowed baseline types: PDF, JPEG, PNG, WebP, MP4, VTT. Videos are capped at 500 MB by the signing API; other allowed files at 25 MB.

Before broad public/admin upload rollout, add asynchronous malware scanning, image metadata stripping where applicable, video transcoding/HLS, subtitle validation and a quarantine/publish lifecycle.

## Direct-upload CORS requirement

The admin UI uploads files directly to the short-lived presigned object-storage URL. Configure the private bucket CORS policy to allow the direct presigned `POST` from the exact ANEI production origin only. The policy constrains the exact declared `Content-Type` and server-selected content-length range. Do not use `*` origins in production. The application's CSP also allowlists the configured storage upload origin.

After upload, ANEI stores only the private object key. Learners receive short-lived signed GET URLs (separate TTLs for downloads and long-running lesson media) after entitlement checks; permanent public object URLs are not used for paid resources or enrolled lesson media.
