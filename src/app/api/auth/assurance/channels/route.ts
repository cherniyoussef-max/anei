import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getAvailableOtpChannels } from "@/server/auth/otp";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const channels = await getAvailableOtpChannels(session.user.id);
  return NextResponse.json({ channels });
}
