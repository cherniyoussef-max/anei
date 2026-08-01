import { and, count, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { avsProfiles, courses, resources, webinars } from "@/server/db/schema";

export async function getHomeStats() {
  const [[courseRow], [webinarRow], [avsRow], [resourceRow]] = await Promise.all([
    db.select({ value: count() }).from(courses).where(eq(courses.published, true)),
    db.select({ value: count() }).from(webinars).where(eq(webinars.published, true)),
    db.select({ value: count() }).from(avsProfiles).where(and(eq(avsProfiles.visible, true), eq(avsProfiles.certified, true))),
    db.select({ value: count() }).from(resources).where(eq(resources.published, true)),
  ]);
  return {
    courses: courseRow?.value ?? 0,
    webinars: webinarRow?.value ?? 0,
    avs: avsRow?.value ?? 0,
    resources: resourceRow?.value ?? 0,
  };
}
