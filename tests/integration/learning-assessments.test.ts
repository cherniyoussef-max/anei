import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);

async function withClient(run: (client: Client) => Promise<void>) {
  if (!url) return;
  const client = new Client({ connectionString: url }); await client.connect();
  try { await run(client); } finally { await client.end(); }
}

async function seedUser(client: Client, label: string) {
  const id = crypto.randomUUID();
  await client.query(`insert into "user" (id,name,email,email_verified,role,profile_type,created_at,updated_at) values ($1,$2,$3,true,'USER','learner',now(),now())`, [id, label, `${label}-${id}@example.test`]);
  return id;
}

async function seedCourse(client: Client) {
  const id = crypto.randomUUID();
  await client.query(`insert into courses (id,slug,title_fr,title_ar,summary_fr,summary_ar,description_fr,description_ar,category,level,mode,trainer_name,duration_minutes,price_millimes,published,featured,objectives,created_at,updated_at) values ($1,$2,'Assessment course','دورة التقييم','Summary','ملخص','Description','وصف','test','beginner','online','ANEI',60,0,true,false,$3::jsonb,now(),now())`, [id, `assessment-${id}`, JSON.stringify({ fr: [], ar: [] })]);
  return id;
}

function options(count: number, correctIndex: number) {
  return Array.from({ length: count }, (_, index) => ({ textFr: `Réponse ${index + 1}`, textAr: `إجابة ${index + 1}`, position: index + 1, isCorrect: index === correctIndex }));
}

test("learning assessment scoring, privacy, idempotency, option ordering, ownership, and structural locks", { skip: !url }, async () => {
  await withClient(async (client) => {
    process.env.TEST_DATABASE_URL = url;
    const service = await import("../../src/server/services/learning-assessments");
    const actorId = await seedUser(client, "Assessment Admin"); const learnerId = await seedUser(client, "Assessment Learner"); const otherId = await seedUser(client, "Other Learner"); const courseId = await seedCourse(client);
    await client.query(`insert into enrollments (id,user_id,course_id,status,progress_percent,source,enrolled_at) values ($1,$2,$3,'active',0,'ADMIN',now())`, [crypto.randomUUID(), learnerId, courseId]);

    try {
      const created = await service.createLearningAssessment(actorId, { courseId, titleFr: "Quiz professionnel", titleAr: "اختبار مهني", instructionsFr: "Répondez à toutes les questions.", instructionsAr: "أجب عن جميع الأسئلة.", timeLimitSeconds: 900, passingScore: 60, maxAttempts: 3 });
      assert.equal(created.kind, "ok"); if (created.kind !== "ok") return;
      const assessmentId = created.assessment.id;

      const first = await service.addLearningQuestion(actorId, assessmentId, { promptFr: "Première question", promptAr: "السؤال الأول", type: "SINGLE_CHOICE", position: 1, points: 2, options: options(5, 3) });
      const second = await service.addLearningQuestion(actorId, assessmentId, { promptFr: "Deuxième question", promptAr: "السؤال الثاني", type: "SINGLE_CHOICE", position: 2, points: 1, options: options(3, 0) });
      assert.equal(first.kind, "ok"); assert.equal(second.kind, "ok"); if (first.kind !== "ok" || second.kind !== "ok") return;
      assert.deepEqual(first.question.options.map((option) => option.position), [1, 2, 3, 4, 5], "dynamic fourth and fifth options persist in order");

      assert.equal((await service.publishLearningAssessment(actorId, assessmentId, true)).kind, "ok");
      const projection = await service.getLearnerAssessment(learnerId, assessmentId);
      assert.ok(projection); assert.equal(JSON.stringify(projection).includes("isCorrect"), false, "learner payload must not expose correctness before grading");

      const started = await service.startLearningAttempt(learnerId, assessmentId); assert.equal(started.kind, "ok"); if (started.kind !== "ok") return;
      const forbidden = await service.submitLearningAttempt(otherId, started.attempt.id, [{ questionId: first.question.id, optionIds: [first.question.options[3].id] }, { questionId: second.question.id, optionIds: [second.question.options[1].id] }]);
      assert.equal(forbidden.kind, "forbidden", "another user cannot submit this attempt");

      const graded = await service.submitLearningAttempt(learnerId, started.attempt.id, [
        { questionId: first.question.id, optionIds: [first.question.options[3].id] },
        { questionId: second.question.id, optionIds: [second.question.options[1].id] },
      ]);
      assert.equal(graded.kind, "ok"); if (graded.kind !== "ok") return;
      assert.equal(graded.attempt.rawPoints, 2, "correct answer earns configured points and incorrect earns zero");
      assert.equal(graded.attempt.maxPoints, 3); assert.equal(graded.attempt.percentage, 67, "percentage is server calculated"); assert.equal(graded.attempt.passed, true, "passing threshold is server authoritative");

      const repeated = await service.submitLearningAttempt(learnerId, started.attempt.id, [
        { questionId: first.question.id, optionIds: [first.question.options[0].id] },
        { questionId: second.question.id, optionIds: [second.question.options[0].id] },
      ]);
      assert.equal(repeated.kind, "ok"); assert.ok(repeated.kind === "ok" && repeated.idempotent); assert.equal(repeated.kind === "ok" ? repeated.attempt.percentage : 0, 67, "repeated submission cannot forge or replace grading");
      const answerCount = await client.query(`select count(*)::int as count from learning_answer where attempt_id=$1`, [started.attempt.id]); assert.equal(answerCount.rows[0].count, 2, "repeated submission does not duplicate answers");

      assert.equal((await service.publishLearningAssessment(actorId, assessmentId, false)).kind, "ok");
      const locked = await service.updateLearningQuestion(actorId, assessmentId, first.question.id, { promptFr: "Mutation interdite", promptAr: "تعديل ممنوع", type: "SINGLE_CHOICE", position: 1, points: 100, options: options(3, 0) });
      assert.equal(locked.kind, "attempts_exist", "unpublishing cannot unlock structural edits after attempts exist");

      const concurrent = await service.createLearningAssessment(actorId, { courseId, titleFr: "Quiz concurrent", titleAr: "اختبار متزامن", timeLimitSeconds: 900, passingScore: 60, maxAttempts: 3 });
      assert.equal(concurrent.kind, "ok"); if (concurrent.kind !== "ok") return;
      const concurrentQuestion = await service.addLearningQuestion(actorId, concurrent.assessment.id, { promptFr: "Question stable", promptAr: "سؤال ثابت", type: "SINGLE_CHOICE", position: 1, points: 1, options: options(3, 0) });
      assert.equal(concurrentQuestion.kind, "ok"); if (concurrentQuestion.kind !== "ok") return;
      assert.equal((await service.publishLearningAssessment(actorId, concurrent.assessment.id, true)).kind, "ok");
      const [concurrentStart, concurrentMutation] = await Promise.all([
        service.startLearningAttempt(learnerId, concurrent.assessment.id),
        (async () => {
          await service.publishLearningAssessment(actorId, concurrent.assessment.id, false);
          return service.updateLearningQuestion(actorId, concurrent.assessment.id, concurrentQuestion.question.id, { promptFr: "Question mutée", promptAr: "سؤال معدّل", type: "SINGLE_CHOICE", position: 1, points: 1, options: options(3, 1) });
        })(),
      ]);
      assert.equal(concurrentStart.kind === "ok" && concurrentMutation.kind === "ok", false, "attempt creation and structural mutation cannot both commit across the assessment lock");
    } finally {
      await client.query("delete from courses where id=$1", [courseId]);
      await client.query('delete from "user" where id=any($1)', [[actorId, learnerId, otherId]]);
    }
  });
});
