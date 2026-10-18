import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getSpecialistWorkspaceData } from "@/server/services/inclusive-ecosystem";

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const data = await getSpecialistWorkspaceData(session.user.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[SpecialistWorkspace GET error]:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
