import { NextResponse } from "next/server";
import { searchActiveSpecialists } from "@/server/queries/care-relationships";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const specialty = url.searchParams.get("specialty") ?? undefined;
  const governorate = url.searchParams.get("governorate") ?? undefined;
  const language = url.searchParams.get("language") ?? undefined;
  const mode = url.searchParams.get("consultationMode") as "IN_PERSON" | "ONLINE" | undefined;
  const query = url.searchParams.get("q") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined;

  const result = await searchActiveSpecialists({
    specialty,
    governorate,
    language,
    consultationMode: mode,
    query,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
