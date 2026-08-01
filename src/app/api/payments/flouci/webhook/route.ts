import { NextResponse } from "next/server";
import { verifyAndApplyByExternalId } from "@/server/services/checkout";
import { readLimitedJson } from "@/server/security/request-body";

function paymentIdFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.payment_id === "string") return body.payment_id;
  if (typeof body.paymentId === "string") return body.paymentId;
  const result = body.result;
  if (result && typeof result === "object" && typeof (result as Record<string, unknown>).payment_id === "string") return (result as Record<string, string>).payment_id;
  return null;
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
  const payload = await readLimitedJson(request, 64 * 1024).catch(() => null);
  const paymentId = paymentIdFrom(payload);
  if (!paymentId || paymentId.length > 128) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    // Never trust webhook payload as proof of payment; re-check directly with Flouci.
    await verifyAndApplyByExternalId("flouci", paymentId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
