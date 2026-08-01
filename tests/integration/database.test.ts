import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? (process.env.NODE_ENV !== "production" ? "postgresql://anei:anei@127.0.0.1:5432/anei" : undefined);

async function withClient(run: (client: Client) => Promise<void>) {
  if (!url) return;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

test("authoritative database constraints and module schema are installed", { skip: !url }, async () => {
  await withClient(async (client) => {
    const constraints = await client.query<{ conname: string }>(`
      select conname from pg_constraint
      where conname in (
        'courses_price_nonnegative',
        'enrollment_progress_range',
        'orders_amount_nonnegative',
        'course_modules_position_positive',
        'certificate_user_course_unique'
      )
    `);
    const names = new Set(constraints.rows.map((row) => row.conname));
    assert.equal(names.has("courses_price_nonnegative"), true);
    assert.equal(names.has("enrollment_progress_range"), true);
    assert.equal(names.has("orders_amount_nonnegative"), true);
    assert.equal(names.has("course_modules_position_positive"), true);

    const moduleTable = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_name='course_modules'",
    );
    assert.equal(moduleTable.rowCount, 1);

    const moduleColumn = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='lessons' and column_name='module_id'",
    );
    assert.equal(moduleColumn.rowCount, 1);
  });
});

test("PostgreSQL rejects an invalid negative course price", { skip: !url }, async () => {
  await withClient(async (client) => {
    const id = crypto.randomUUID();
    const slug = `constraint-${id}`;
    await assert.rejects(
      client.query(
        `insert into courses
          (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
           category, level, mode, trainer_name, duration_minutes, price_millimes, published, featured,
           objectives, created_at, updated_at)
         values ($1,$2,'Test','اختبار','Test','اختبار','Test','اختبار','test','beginner','online',
                 'ANEI',60,-1,false,false,$3::jsonb,now(),now())`,
        [id, slug, JSON.stringify({ fr: [], ar: [] })],
      ),
      /courses_price_nonnegative|check constraint/i,
    );
  });
});

test("PostgreSQL rejects a non-positive module position", { skip: !url }, async () => {
  await withClient(async (client) => {
    const courseId = crypto.randomUUID();
    const moduleId = crypto.randomUUID();
    await client.query("begin");
    try {
      await client.query(
        `insert into courses
          (id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
           category, level, mode, trainer_name, duration_minutes, price_millimes, published, featured,
           objectives, created_at, updated_at)
         values ($1,$2,'Test','اختبار','Test','اختبار','Test','اختبار','test','beginner','online',
                 'ANEI',60,0,false,false,$3::jsonb,now(),now())`,
        [courseId, `module-constraint-${courseId}`, JSON.stringify({ fr: [], ar: [] })],
      );
      await client.query("savepoint before_invalid_module");
      await assert.rejects(
        client.query(
          `insert into course_modules
            (id, course_id, position, title_fr, title_ar, description_fr, description_ar, created_at)
           values ($1,$2,0,'Module','وحدة','','',now())`,
          [moduleId, courseId],
        ),
        /course_modules_position_positive|check constraint/i,
      );
      await client.query("rollback to savepoint before_invalid_module");
    } finally {
      await client.query("rollback");
    }
  });
});
