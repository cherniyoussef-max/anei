import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { courseDiscussionPosts, courses, enrollments, notifications, user, userProfile } from "@/server/db/schema";

export type CourseDiscussionItem = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  authorFirstName: string;
  own: boolean;
};

async function enrolledCourse(userId: string, courseId: string) {
  const [row] = await db
    .select({ id: enrollments.id, slug: courses.slug, titleFr: courses.titleFr, titleAr: courses.titleAr })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId), inArray(enrollments.status, ["active", "completed"])))
    .limit(1);
  return row ?? null;
}

function firstName(profileFirstName: string | null, accountName: string) {
  return profileFirstName?.trim() || accountName.trim().split(/\s+/)[0] || "ANEI";
}

export async function getCourseDiscussion(userId: string, courseId: string): Promise<CourseDiscussionItem[] | null> {
  if (!(await enrolledCourse(userId, courseId))) return null;
  const rows = await db
    .select({
      id: courseDiscussionPosts.id,
      parentId: courseDiscussionPosts.parentId,
      body: courseDiscussionPosts.body,
      createdAt: courseDiscussionPosts.createdAt,
      authorUserId: courseDiscussionPosts.authorUserId,
      accountName: user.name,
      profileFirstName: userProfile.firstName,
    })
    .from(courseDiscussionPosts)
    .innerJoin(user, eq(courseDiscussionPosts.authorUserId, user.id))
    .leftJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(courseDiscussionPosts.courseId, courseId))
    .orderBy(asc(courseDiscussionPosts.createdAt))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    body: row.body,
    createdAt: row.createdAt,
    authorFirstName: firstName(row.profileFirstName, row.accountName),
    own: row.authorUserId === userId,
  }));
}

export async function createCourseDiscussionPost(userId: string, input: { courseId: string; parentId?: string | null; body: string }) {
  const course = await enrolledCourse(userId, input.courseId);
  if (!course) return { kind: "not_entitled" as const };

  let parent: { id: string; authorUserId: string; parentId: string | null } | null = null;
  if (input.parentId) {
    const [row] = await db
      .select({ id: courseDiscussionPosts.id, authorUserId: courseDiscussionPosts.authorUserId, parentId: courseDiscussionPosts.parentId })
      .from(courseDiscussionPosts)
      .where(and(eq(courseDiscussionPosts.id, input.parentId), eq(courseDiscussionPosts.courseId, input.courseId)))
      .limit(1);
    if (!row || row.parentId) return { kind: "invalid_parent" as const };
    parent = row;
  }

  return db.transaction(async (tx) => {
    const [post] = await tx.insert(courseDiscussionPosts).values({
      courseId: input.courseId,
      authorUserId: userId,
      parentId: parent?.id ?? null,
      body: input.body.trim(),
    }).returning({ id: courseDiscussionPosts.id });

    if (parent && parent.authorUserId !== userId) {
      const [owner] = await tx.select({ locale: user.locale }).from(user).where(eq(user.id, parent.authorUserId)).limit(1);
      const locale = owner?.locale === "ar" ? "ar" : "fr";
      await tx.insert(notifications).values({
        userId: parent.authorUserId,
        type: "course_discussion_reply",
        title: locale === "ar" ? "رد جديد على سؤالك" : "Nouvelle réponse à votre question",
        body: locale === "ar" ? `تمت إضافة إجابة جديدة في دورة «${course.titleAr}».` : `Une nouvelle réponse a été ajoutée dans «${course.titleFr}».`,
        href: `/${locale}/apprendre/${course.slug}#questions`,
      });
    }

    return { kind: "ok" as const, id: post.id };
  });
}
