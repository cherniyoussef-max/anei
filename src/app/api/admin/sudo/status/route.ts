import { NextResponse } from "next/server";
import { getAdminSession } from "@/server/auth/admin";
import { isSudoModeActive } from "@/server/auth/sudo";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ active: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const active = await isSudoModeActive(request, session.user.id);
  return NextResponse.json({ active });
}
