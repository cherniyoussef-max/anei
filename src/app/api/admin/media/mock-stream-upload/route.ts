import { NextResponse } from "next/server";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";

const noStore = { "Cache-Control": "private, no-store" } as const;

/**
 * Local development / test mock endpoint for Cloudflare Stream direct uploads.
 * Emulates the response of Cloudflare's upload.videodelivery.net endpoint
 * when real Cloudflare credentials are not present in the local environment.
 */
export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403, headers: noStore });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  // Drain the body stream in dev
  try {
    const formData = await request.formData();
    void formData;
  } catch {
    // ignore parse error if raw stream
  }

  return NextResponse.json(
    {
      success: true,
      result: {
        uid: "0123456789abcdef0123456789abcdef",
      },
    },
    { status: 200, headers: noStore },
  );
}
