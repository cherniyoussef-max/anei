import { NextResponse } from "next/server";
import { getSessionAssurance } from "@/server/auth/assurance";
import { auth } from "@/server/auth";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ authenticated: false, assured: false });
  const assurance = await getSessionAssurance(session.session.id);
  return NextResponse.json({
    authenticated: true,
    assured: Boolean(assurance),
    method: assurance?.method ?? null,
    expiresAt: assurance?.expiresAt.toISOString() ?? null,
  });
}
