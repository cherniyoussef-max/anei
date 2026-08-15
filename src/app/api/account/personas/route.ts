import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { getUserPersonas } from "@/server/queries/personas";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getSession();
  if (!current) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const memberships = await getUserPersonas(current.user.id);
  return NextResponse.json({ personas: memberships.map((row) => ({ persona: row.persona, status: row.status, isPrimary: row.isPrimary })) });
}
