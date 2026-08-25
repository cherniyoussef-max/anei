import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("course discussion mutation is origin protected, authenticated, bounded, rate limited, and strict", async () => {
  const source = await readFile("src/app/api/learning/courses/[courseId]/discussion/route.ts", "utf8");
  const origin = source.indexOf("isTrustedMutation(request)");
  const session = source.indexOf("getSession()");
  const rate = source.indexOf("await consumeRateLimit");
  const body = source.indexOf("readLimitedJson(request)");
  assert.equal(origin >= 0 && session > origin && rate > session && body > rate, true);
  assert.equal(source.includes(".max(2000)"), true);
  assert.equal(source.includes(".strict()"), true);
  assert.equal(source.includes("z.string().uuid()"), true);
});

test("course discussion authorization is enrollment scoped and replies notify the question author", async () => {
  const source = await readFile("src/server/services/course-discussion.ts", "utf8");
  assert.equal(source.includes("eq(enrollments.userId, userId)"), true);
  assert.equal(source.includes("eq(enrollments.courseId, courseId)"), true);
  assert.equal(source.includes('inArray(enrollments.status, ["active", "completed"])'), true);
  assert.equal(source.includes("eq(courseDiscussionPosts.courseId, input.courseId)"), true);
  assert.equal(source.includes("parent.authorUserId !== userId"), true);
  assert.equal(source.includes('type: "course_discussion_reply"'), true);
});

test("enrolled course route lives in the learner shell and exposes real questions without public chrome", async () => {
  const [courseRoom, learnerLayout] = await Promise.all([
    readFile("src/app/[locale]/(learner)/apprendre/[slug]/page.tsx", "utf8"),
    readFile("src/app/[locale]/(learner)/layout.tsx", "utf8"),
  ]);
  assert.equal(courseRoom.includes("getLearningCourse(session.user.id, slug)"), true);
  assert.equal(courseRoom.includes("getCourseDiscussion(session.user.id, data.course.id)"), true);
  assert.equal(courseRoom.includes("<CourseDiscussion"), true);
  assert.equal(learnerLayout.includes("<StudentShell"), true);
});
