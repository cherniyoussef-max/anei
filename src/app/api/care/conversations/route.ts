import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getCareConversationsForUser } from "@/server/queries/care-messaging";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const conversations = await getCareConversationsForUser(session.user.id);
  return NextResponse.json({ conversations });
}
