import "server-only";
import crypto from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { env } from "@/server/env";

const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "text/vtt",
]);

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "text/vtt": "vtt",
};

function client() {
  if (env.STORAGE_PROVIDER !== "s3-compatible") throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");
  return new S3Client({
    region: env.STORAGE_REGION!,
    endpoint: env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
    },
  });
}

function safeDispositionFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (normalized || "resource").slice(0, 120);
}

/** Generate a short-lived entitlement-gated object download URL. */
export async function signedDownloadUrl(objectKey: string, filename: string) {
  if (!objectKey || objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    throw new Error("INVALID_PRIVATE_OBJECT_KEY");
  }
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeDispositionFilename(filename)}"`,
    }),
    { expiresIn: env.STORAGE_DOWNLOAD_URL_TTL_SECONDS },
  );
}


/** Short-lived inline URL for entitlement-gated course media. */
export async function signedMediaUrl(objectKey: string) {
  if (!objectKey || objectKey.startsWith("http://") || objectKey.startsWith("https://") || objectKey.startsWith("/")) {
    throw new Error("INVALID_PRIVATE_OBJECT_KEY");
  }
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env.STORAGE_BUCKET!,
      Key: objectKey,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: env.STORAGE_MEDIA_URL_TTL_SECONDS },
  );
}

export function validateUpload(input: { contentType: string; contentLength: number }) {
  if (!ALLOWED_UPLOAD_TYPES.has(input.contentType)) throw new Error("UNSUPPORTED_MEDIA_TYPE");
  const max = input.contentType === "video/mp4" ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
  if (!Number.isSafeInteger(input.contentLength) || input.contentLength <= 0 || input.contentLength > max) {
    throw new Error("INVALID_FILE_SIZE");
  }
}

/**
 * Admin-only direct-to-object-storage upload. The POST policy is enforced by
 * object storage as well as by ANEI: exact declared Content-Type and a
 * content-length range bounded by the server-selected maximum.
 */
export async function signedUploadUrl(input: {
  category: "resource" | "course" | "avatar" | "certificate";
  contentType: string;
  contentLength: number;
}) {
  validateUpload(input);
  const ext = EXTENSIONS[input.contentType];
  const key = `${input.category}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const max = input.contentType === "video/mp4" ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
  const signed = await createPresignedPost(client(), {
    Bucket: env.STORAGE_BUCKET!,
    Key: key,
    Expires: 300,
    Fields: {
      "Content-Type": input.contentType,
    },
    Conditions: [
      ["eq", "$Content-Type", input.contentType],
      ["content-length-range", 1, max],
    ],
  });
  return { objectKey: key, uploadUrl: signed.url, fields: signed.fields, expiresInSeconds: 300 };
}
