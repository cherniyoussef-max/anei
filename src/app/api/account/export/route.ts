import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  certificates,
  courses,
  enrollments,
  orders,
  purchases,
  resources,
  user,
  webinarRegistrations,
  webinars,
} from "@/server/db/schema";
import { consumeRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getSession();
  if (!current) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rate = await consumeRateLimit(`account-export:${current.user.id}`, 3, 3600);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const [profile] = await db
    .select({ id: user.id, name: user.name, email: user.email, locale: user.locale, profileType: user.profileType, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, current.user.id))
    .limit(1);
  if (!profile) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const [courseRows, purchaseRows, orderRows, webinarRows, certificateRows] = await Promise.all([
    db
      .select({ course: courses.titleFr, status: enrollments.status, progressPercent: enrollments.progressPercent, enrolledAt: enrollments.enrolledAt, completedAt: enrollments.completedAt })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, current.user.id)),
    db
      .select({ resource: resources.titleFr, grantedAt: purchases.grantedAt })
      .from(purchases)
      .innerJoin(resources, eq(purchases.resourceId, resources.id))
      .where(eq(purchases.userId, current.user.id)),
    db
      .select({ id: orders.id, itemType: orders.itemType, itemLabel: orders.itemLabel, amountMillimes: orders.amountMillimes, currency: orders.currency, status: orders.status, provider: orders.provider, createdAt: orders.createdAt })
      .from(orders)
      .where(eq(orders.userId, current.user.id)),
    db
      .select({ webinar: webinars.titleFr, startsAt: webinars.startsAt, registeredAt: webinarRegistrations.registeredAt })
      .from(webinarRegistrations)
      .innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
      .where(eq(webinarRegistrations.userId, current.user.id)),
    db
      .select({ code: certificates.code, course: courses.titleFr, issuedAt: certificates.issuedAt })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, current.user.id)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    learning: courseRows,
    resourcePurchases: purchaseRows,
    orders: orderRows,
    webinarRegistrations: webinarRows,
    certificates: certificateRows,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="anei-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
