import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { newsletterSubscriptions } from "@/server/db/schema";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
const schema=z.object({email:z.string().trim().email().max(200),locale:z.enum(["fr","ar"]).default("fr")});
export async function POST(request:Request){if(!isTrustedMutation(request))return NextResponse.json({error:"UNTRUSTED_ORIGIN"},{status:403});const rate=await consumeRateLimit(`newsletter:${requestFingerprint(request)}`,10,3600);if(!rate.allowed)return NextResponse.json({error:"RATE_LIMITED"},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});const parsed=schema.safeParse(await readLimitedJson(request).catch(() => null));if(!parsed.success)return NextResponse.json({error:"INVALID_INPUT"},{status:400});await db.insert(newsletterSubscriptions).values(parsed.data).onConflictDoUpdate({target:newsletterSubscriptions.email,set:{locale:parsed.data.locale,active:true}});return NextResponse.json({ok:true},{status:201})}
