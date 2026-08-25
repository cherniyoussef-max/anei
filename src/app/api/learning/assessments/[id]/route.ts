import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { getLearnerAssessment } from "@/server/services/learning-assessments";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const assessment = await getLearnerAssessment(session.user.id, id.data);
  return assessment ? NextResponse.json({ assessment }) : NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
}
