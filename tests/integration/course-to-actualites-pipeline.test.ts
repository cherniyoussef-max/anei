import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";

const url =
  process.env.TEST_DATABASE_URL ??
  (process.env.NODE_ENV !== "production"
    ? "postgresql://anei:anei@127.0.0.1:5432/anei"
    : undefined);

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

async function seedCourse(
  client: Client,
  slug: string,
  titleFr: string,
  titleAr: string
): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    `insert into courses (
      id, slug, title_fr, title_ar, summary_fr, summary_ar, description_fr, description_ar,
      category, level, mode, trainer_name, duration_minutes, price_millimes,
      published, featured, objectives, created_at, updated_at
    ) values ($1, $2, $3, $4, 'Résumé FR', 'ملخص عربي', 'Description détaillée FR', 'وصف تفصيلي عربي',
      'INCLUSION', 'intermediate', 'online', 'Dr. Amira Khemir', 120, 45000,
      true, true, $5::jsonb, now(), now())`,
    [
      id,
      slug,
      titleFr,
      titleAr,
      JSON.stringify({
        fr: ["Adapter les supports", "Évaluer sans biais"],
        ar: ["تكييف الوسائط البيداغوجية", "التقييم العادل"],
      }),
    ]
  );
  return id;
}

async function seedWebinar(
  client: Client,
  slug: string,
  titleFr: string,
  titleAr: string
): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    `insert into webinars (
      id, slug, title_fr, title_ar, description_fr, description_ar,
      trainer_name, starts_at, duration_minutes, meeting_provider,
      published, category
    ) values ($1, $2, $3, $4, 'Webinaire interactif', 'ندوة تفاعلية مباشرة',
      'Expert ANEI', now() + interval '2 days', 90, 'google_meet',
      true, 'FORMATION_LIVE')`,
    [id, slug, titleFr, titleAr]
  );
  return id;
}

test(
  "course-to-actualites auto-syndication pipeline, atomic top featured ordering and cache consistency",
  { skip: !url },
  async () => {
    await withClient(async (client) => {
      process.env.TEST_DATABASE_URL = url;
      const {
        syncCourseToActualites,
        syncWebinarToActualites,
        deleteSyndicatedCourseNews,
      } = await import("../../src/server/services/auto-news-syndication");
      const { getTopFeaturedNewsPost, getPublishedNews } = await import(
        "../../src/server/queries/news"
      );

      const uniquePrefix = `test-${Date.now()}`;
      const course1Slug = `${uniquePrefix}-autisme`;
      const course2Slug = `${uniquePrefix}-dyslexie`;
      const webinarSlug = `${uniquePrefix}-webinar-pei`;

      let course1Id: string | null = null;
      let course2Id: string | null = null;
      let webinarId: string | null = null;

      try {
        // 1. Seed Course 1
        course1Id = await seedCourse(
          client,
          course1Slug,
          "Accompagnement de l'autisme en classe",
          "مرافقة التوحد في القسم الدامج"
        );

        // 2. Syndicate Course 1 to Actualités
        const syncResult1 = await syncCourseToActualites(course1Id, { isFeatured: true });
        assert.equal(syncResult1.ok, true, "Course 1 syndication should succeed");

        // 3. Verify PostgreSQL news_posts state for Course 1
        const news1Res = await client.query(
          `select * from news_posts where slug = $1`,
          [`formation-${course1Slug}`]
        );
        assert.equal(news1Res.rowCount, 1, "Syndicated news row must exist");
        const news1 = news1Res.rows[0];
        assert.equal(news1.category, "FORMATION");
        assert.equal(news1.tag_fr, "Formation certifiante");
        assert.equal(news1.tag_ar, "دورة تكوينية إشهادية");
        assert.equal(news1.is_featured, true, "Course 1 news post should initially be featured");
        assert.equal(news1.published, true, "Course 1 news post should be published");
        assert.ok(
          news1.content_fr.includes(`/fr/formations/${course1Slug}`),
          "Content FR must include direct CTA link to course"
        );
        assert.ok(
          news1.content_ar.includes(`/ar/formations/${course1Slug}`),
          "Content AR must include direct CTA link to course"
        );

        // 4. Seed Course 2 (newest content)
        course2Id = await seedCourse(
          client,
          course2Slug,
          "Stratégies pédagogiques pour les troubles DYS",
          "استراتيجيات بيداغوجية لاضطرابات التعلم الديس"
        );

        // 5. Syndicate Course 2 as new Top Featured
        const syncResult2 = await syncCourseToActualites(course2Id, { isFeatured: true });
        assert.equal(syncResult2.ok, true, "Course 2 syndication should succeed");

        // 6. Verify atomic demotion: Course 1 demoted, Course 2 promoted to Top #1
        const checkFeatured = await client.query(
          `select slug, is_featured from news_posts where slug in ($1, $2) order by created_at asc`,
          [`formation-${course1Slug}`, `formation-${course2Slug}`]
        );
        assert.equal(checkFeatured.rowCount, 2);
        const row1 = checkFeatured.rows.find((r) => r.slug === `formation-${course1Slug}`);
        const row2 = checkFeatured.rows.find((r) => r.slug === `formation-${course2Slug}`);
        assert.equal(row1?.is_featured, false, "Course 1 must be demoted atomically to is_featured: false");
        assert.equal(row2?.is_featured, true, "Course 2 must be Top #1 is_featured: true");

        // 7. Verify query getTopFeaturedNewsPost() returns Course 2
        const topFeatured = await getTopFeaturedNewsPost();
        assert.ok(topFeatured, "Top featured article must not be null");
        assert.equal(
          topFeatured.slug,
          `formation-${course2Slug}`,
          "Query must return newest featured course as Top #1"
        );

        // 8. Verify getPublishedNews() returns Course 2 at index 0
        const feed = await getPublishedNews();
        assert.ok(feed.length >= 2, "Published news feed must contain at least 2 items");
        assert.equal(
          feed[0].slug,
          `formation-${course2Slug}`,
          "Top position in full feed must be Course 2"
        );

        // 9. Seed and syndicate a Webinar
        webinarId = await seedWebinar(
          client,
          webinarSlug,
          "Le Projet Personnalisé de Scolarisation en Direct",
          "مشروع الدمج الفردي في بث مباشر"
        );
        const webinarSync = await syncWebinarToActualites(webinarId, { isFeatured: true });
        assert.equal(webinarSync.ok, true, "Webinar syndication should succeed");

        const checkWebinarFeatured = await client.query(
          `select slug, is_featured from news_posts where slug in ($1, $2, $3)`,
          [`formation-${course1Slug}`, `formation-${course2Slug}`, `webinaire-${webinarSlug}`]
        );
        const wRow = checkWebinarFeatured.rows.find((r) => r.slug === `webinaire-${webinarSlug}`);
        const c2Row = checkWebinarFeatured.rows.find((r) => r.slug === `formation-${course2Slug}`);
        assert.equal(wRow?.is_featured, true, "Webinar must now be Top #1 featured");
        assert.equal(c2Row?.is_featured, false, "Course 2 must be demoted when webinar is featured");

        // 10. Test deletion synchronization
        await deleteSyndicatedCourseNews(course2Slug);
        const postCheck = await client.query(
          `select id from news_posts where slug = $1`,
          [`formation-${course2Slug}`]
        );
        assert.equal(postCheck.rowCount, 0, "Syndicated news row must be cleanly deleted when course is removed");
      } finally {
        // Clean up test data
        await client.query(
          `delete from news_posts where slug in ($1, $2, $3)`,
          [`formation-${course1Slug}`, `formation-${course2Slug}`, `webinaire-${webinarSlug}`]
        );
        if (webinarId) {
          await client.query(`delete from webinars where id = $1`, [webinarId]);
        }
        if (course2Id) {
          await client.query(`delete from courses where id = $1`, [course2Id]);
        }
        if (course1Id) {
          await client.query(`delete from courses where id = $1`, [course1Id]);
        }
      }
    });
  }
);
