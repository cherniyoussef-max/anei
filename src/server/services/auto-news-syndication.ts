import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import {
  courses,
  newsPosts,
  resources,
  webinars,
  type CourseRow,
} from "@/server/db/schema";
import { logger } from "@/server/security/logger";

/**
 * Revalidates all public paths impacted by news/course syndication.
 */
export function revalidateAllPublicFeeds(): void {
  try {
    revalidatePath("/[locale]/actualites", "page");
    revalidatePath("/[locale]", "page");
    revalidatePath("/fr");
    revalidatePath("/ar");
    revalidatePath("/en");
    revalidatePath("/fr/actualites");
    revalidatePath("/ar/actualites");
    revalidatePath("/en/actualites");
    revalidatePath("/fr/formations");
    revalidatePath("/ar/formations");
    revalidatePath("/en/formations");
    revalidatePath("/fr/dashboard/etablissement");
    revalidatePath("/ar/dashboard/etablissement");
  } catch {
    // In background workers or isolated unit tests, Next cache revalidation may not be mounted.
  }
}

/**
 * Resolves a public cover image URL for a given image key or URL.
 */
function resolveCoverImageUrl(coverImage: string | null | undefined): string {
  if (!coverImage) return "/media/home-v5/une-feature.jpg";
  if (coverImage.startsWith("http://") || coverImage.startsWith("https://") || coverImage.startsWith("/")) {
    return coverImage;
  }
  return `/media/home-v5/une-feature.jpg`;
}

/**
 * Formats rich HTML content for a course syndication article in French.
 */
function buildCourseContentFr(course: CourseRow): string {
  const objectivesFr = Array.isArray(course.objectives?.fr) ? course.objectives.fr : [];
  const levelLabel =
    course.level === "advanced"
      ? "Avancé"
      : course.level === "intermediate"
      ? "Intermédiaire"
      : "Débutant / Fondamental";
  const modeLabel =
    course.mode === "hybrid"
      ? "Hybride (En ligne & Présentiel)"
      : course.mode === "onsite"
      ? "Présentiel"
      : "100% En ligne";

  return `
<div class="space-y-6">
  <p class="text-lg text-slate-700 leading-relaxed font-normal">
    ${course.summaryFr || course.descriptionFr}
  </p>

  <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
    <h3 class="text-base font-bold text-[#0A192F] uppercase tracking-wider text-xs">
      Fiche synthétique du programme
    </h3>
    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
      <li><strong class="text-slate-900">Niveau :</strong> ${levelLabel}</li>
      <li><strong class="text-slate-900">Format :</strong> ${modeLabel}</li>
      <li><strong class="text-slate-900">Durée estimée :</strong> ${Math.max(1, Math.round(course.durationMinutes / 60))} h (${course.durationMinutes} min)</li>
      <li><strong class="text-slate-900">Formateur référent :</strong> ${course.trainerName}</li>
    </ul>
  </div>

  <div>
    <h3 class="text-xl font-bold text-[#0A192F] mb-3">Présentation détaillée</h3>
    <p class="text-slate-600 leading-relaxed whitespace-pre-line font-normal">
      ${course.descriptionFr}
    </p>
  </div>

  ${
    objectivesFr.length > 0
      ? `
  <div>
    <h3 class="text-xl font-bold text-[#0A192F] mb-3">Compétences visées & objectifs pédagogiques</h3>
    <ul class="list-disc list-inside space-y-2 text-slate-600">
      ${objectivesFr.map((obj) => `<li>${obj}</li>`).join("")}
    </ul>
  </div>
  `
      : ""
  }

  <div class="pt-6 border-t border-slate-200">
    <a
      href="/fr/formations/${course.slug}"
      class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold transition-all shadow-sm"
    >
      <span>Découvrir la formation et s'inscrire au parcours</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</div>
`.trim();
}

/**
 * Formats rich HTML content for a course syndication article in Arabic.
 */
function buildCourseContentAr(course: CourseRow): string {
  const objectivesAr = Array.isArray(course.objectives?.ar) ? course.objectives.ar : [];
  const levelLabel =
    course.level === "advanced"
      ? "متقدم"
      : course.level === "intermediate"
      ? "متوسط"
      : "تأسيسي / مبتدئ";
  const modeLabel =
    course.mode === "hybrid"
      ? "مزدوج (حضوري وعبر الإنترنت)"
      : course.mode === "onsite"
      ? "حضوري بالمؤسسة"
      : "عبر الإنترنت 100%";

  return `
<div class="space-y-6" dir="rtl">
  <p class="text-lg text-slate-700 leading-relaxed font-normal">
    ${course.summaryAr || course.descriptionAr}
  </p>

  <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
    <h3 class="text-base font-bold text-[#0A192F] uppercase tracking-wider text-xs">
      بطاقة تعريفية للبرنامج التكويني
    </h3>
    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
      <li><strong class="text-slate-900">المستوى:</strong> ${levelLabel}</li>
      <li><strong class="text-slate-900">نمط التكوين:</strong> ${modeLabel}</li>
      <li><strong class="text-slate-900">المدة التقديرية:</strong> ${Math.max(1, Math.round(course.durationMinutes / 60))} ساعة (${course.durationMinutes} دقيقة)</li>
      <li><strong class="text-slate-900">المؤطر المعتمد:</strong> ${course.trainerName}</li>
    </ul>
  </div>

  <div>
    <h3 class="text-xl font-bold text-[#0A192F] mb-3">تفاصيل الدورة ومحتواها</h3>
    <p class="text-slate-600 leading-relaxed whitespace-pre-line font-normal">
      ${course.descriptionAr}
    </p>
  </div>

  ${
    objectivesAr.length > 0
      ? `
  <div>
    <h3 class="text-xl font-bold text-[#0A192F] mb-3">الأهداف البيداغوجية والكفايات المستهدفة</h3>
    <ul class="list-disc list-inside space-y-2 text-slate-600">
      ${objectivesAr.map((obj) => `<li>${obj}</li>`).join("")}
    </ul>
  </div>
  `
      : ""
  }

  <div class="pt-6 border-t border-slate-200">
    <a
      href="/ar/formations/${course.slug}"
      class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold transition-all shadow-sm"
    >
      <span>اكتشف تفاصيل الدورة والتسجيل المباشر</span>
      <span aria-hidden="true">←</span>
    </a>
  </div>
</div>
`.trim();
}

/**
 * Synchronizes a Course to the News Feed (news_posts table).
 * Places the course as Top Featured ("À LA UNE") by default if featured or published.
 */
export async function syncCourseToActualites(
  courseId: string,
  options?: { isFeatured?: boolean }
): Promise<{ ok: boolean; newsPostId?: string }> {
  try {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      logger.warn("auto_syndication.course_not_found", { courseId });
      return { ok: false };
    }

    const newsSlug = `formation-${course.slug}`;
    const shouldBeFeatured = options?.isFeatured ?? (course.featured ?? true);
    const isPublished = Boolean(course.published);

    const titleFr = course.titleFr.toLowerCase().startsWith("formation")
      ? course.titleFr
      : `Formation certifiante : ${course.titleFr}`;

    const titleAr = course.titleAr.startsWith("دورة") || course.titleAr.startsWith("تكوين")
      ? course.titleAr
      : `دورة تكوينية إشهادية: ${course.titleAr}`;

    const coverImageUrl = resolveCoverImageUrl(course.coverImage);

    const syndicatedPost = await db.transaction(async (tx) => {
      // 1. If this article is featured, demote all other featured articles atomically
      if (shouldBeFeatured && isPublished) {
        await tx
          .update(newsPosts)
          .set({ isFeatured: false })
          .where(eq(newsPosts.isFeatured, true));
      }

      // 2. Check if a syndicated news item already exists for this slug
      const [existing] = await tx
        .select()
        .from(newsPosts)
        .where(eq(newsPosts.slug, newsSlug))
        .limit(1);

      if (existing) {
        const [updated] = await tx
          .update(newsPosts)
          .set({
            category: "FORMATION",
            tagFr: "Formation certifiante",
            tagAr: "دورة تكوينية إشهادية",
            titleFr,
            titleAr,
            excerptFr: course.summaryFr || course.descriptionFr.slice(0, 300),
            excerptAr: course.summaryAr || course.descriptionAr.slice(0, 300),
            contentFr: buildCourseContentFr(course),
            contentAr: buildCourseContentAr(course),
            coverImageUrl,
            isFeatured: shouldBeFeatured && isPublished,
            published: isPublished,
            publishedAt: isPublished ? (existing.publishedAt || new Date()) : null,
            updatedAt: new Date(),
          })
          .where(eq(newsPosts.id, existing.id))
          .returning();

        return updated;
      } else {
        const [inserted] = await tx
          .insert(newsPosts)
          .values({
            slug: newsSlug,
            category: "FORMATION",
            tagFr: "Formation certifiante",
            tagAr: "دورة تكوينية إشهادية",
            titleFr,
            titleAr,
            excerptFr: course.summaryFr || course.descriptionFr.slice(0, 300),
            excerptAr: course.summaryAr || course.descriptionAr.slice(0, 300),
            contentFr: buildCourseContentFr(course),
            contentAr: buildCourseContentAr(course),
            coverImageUrl,
            isFeatured: shouldBeFeatured && isPublished,
            published: isPublished,
            publishedAt: isPublished ? new Date() : null,
          })
          .returning();

        return inserted;
      }
    });

    // 3. Revalidate public cache
    revalidateAllPublicFeeds();

    logger.info("auto_syndication.course_synced", {
      courseId,
      newsPostId: syndicatedPost?.id,
      slug: newsSlug,
      isFeatured: shouldBeFeatured && isPublished,
    });

    return { ok: true, newsPostId: syndicatedPost?.id };
  } catch (error) {
    logger.error("auto_syndication.course_sync_failed", {
      courseId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}

/**
 * Synchronizes a Webinar to the News Feed.
 */
export async function syncWebinarToActualites(
  webinarId: string,
  options?: { isFeatured?: boolean }
): Promise<{ ok: boolean; newsPostId?: string }> {
  try {
    const [webinar] = await db
      .select()
      .from(webinars)
      .where(eq(webinars.id, webinarId))
      .limit(1);

    if (!webinar) {
      logger.warn("auto_syndication.webinar_not_found", { webinarId });
      return { ok: false };
    }

    const newsSlug = `webinaire-${webinar.slug}`;
    const shouldBeFeatured = options?.isFeatured ?? false;
    const isPublished = Boolean(webinar.published);

    const syndicatedPost = await db.transaction(async (tx) => {
      if (shouldBeFeatured && isPublished) {
        await tx
          .update(newsPosts)
          .set({ isFeatured: false })
          .where(eq(newsPosts.isFeatured, true));
      }

      const [existing] = await tx
        .select()
        .from(newsPosts)
        .where(eq(newsPosts.slug, newsSlug))
        .limit(1);

      const contentFr = `
<div class="space-y-6">
  <p class="text-lg text-slate-700 leading-relaxed font-normal">
    ${webinar.descriptionFr}
  </p>
  <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
    <h3 class="text-base font-bold text-[#0A192F] uppercase tracking-wider text-xs">
      Informations pratiques
    </h3>
    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
      <li><strong class="text-slate-900">Date & Heure :</strong> ${new Date(webinar.startsAt).toLocaleString("fr-FR")}</li>
      <li><strong class="text-slate-900">Durée :</strong> ${webinar.durationMinutes} minutes</li>
      <li><strong class="text-slate-900">Intervenant :</strong> ${webinar.trainerName}</li>
      <li><strong class="text-slate-900">Format :</strong> Webinaire interactif en direct</li>
    </ul>
  </div>
  <div class="pt-6 border-t border-slate-200">
    <a
      href="/fr/webinaires"
      class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold transition-all shadow-sm"
    >
      <span>Réserver sa place pour le direct</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</div>
`.trim();

      const contentAr = `
<div class="space-y-6" dir="rtl">
  <p class="text-lg text-slate-700 leading-relaxed font-normal">
    ${webinar.descriptionAr}
  </p>
  <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
    <h3 class="text-base font-bold text-[#0A192F] uppercase tracking-wider text-xs">
      معلومات الفعالية
    </h3>
    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
      <li><strong class="text-slate-900">الموعد:</strong> ${new Date(webinar.startsAt).toLocaleString("ar-TN")}</li>
      <li><strong class="text-slate-900">المدة:</strong> ${webinar.durationMinutes} دقيقة</li>
      <li><strong class="text-slate-900">المحاضر:</strong> ${webinar.trainerName}</li>
      <li><strong class="text-slate-900">النمط:</strong> ندوة تفاعلية مباشرة عبر الإنترنت</li>
    </ul>
  </div>
  <div class="pt-6 border-t border-slate-200">
    <a
      href="/ar/webinaires"
      class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold transition-all shadow-sm"
    >
      <span>حجز مقعد في البث المباشر</span>
      <span aria-hidden="true">←</span>
    </a>
  </div>
</div>
`.trim();

      if (existing) {
        const [updated] = await tx
          .update(newsPosts)
          .set({
            category: "EVENEMENT",
            tagFr: "Webinaire en direct",
            tagAr: "ندوة تفاعلية مباشرة",
            titleFr: `Webinaire en direct : ${webinar.titleFr}`,
            titleAr: `ندوة مباشرة: ${webinar.titleAr}`,
            excerptFr: webinar.descriptionFr.slice(0, 300),
            excerptAr: webinar.descriptionAr.slice(0, 300),
            contentFr,
            contentAr,
            coverImageUrl: "/media/home-v5/une-feature.jpg",
            isFeatured: shouldBeFeatured && isPublished,
            published: isPublished,
            publishedAt: isPublished ? (existing.publishedAt || new Date()) : null,
            updatedAt: new Date(),
          })
          .where(eq(newsPosts.id, existing.id))
          .returning();
        return updated;
      } else {
        const [inserted] = await tx
          .insert(newsPosts)
          .values({
            slug: newsSlug,
            category: "EVENEMENT",
            tagFr: "Webinaire en direct",
            tagAr: "ندوة تفاعلية مباشرة",
            titleFr: `Webinaire en direct : ${webinar.titleFr}`,
            titleAr: `ندوة مباشرة: ${webinar.titleAr}`,
            excerptFr: webinar.descriptionFr.slice(0, 300),
            excerptAr: webinar.descriptionAr.slice(0, 300),
            contentFr,
            contentAr,
            coverImageUrl: "/media/home-v5/une-feature.jpg",
            isFeatured: shouldBeFeatured && isPublished,
            published: isPublished,
            publishedAt: isPublished ? new Date() : null,
          })
          .returning();
        return inserted;
      }
    });

    revalidateAllPublicFeeds();
    return { ok: true, newsPostId: syndicatedPost?.id };
  } catch (error) {
    logger.error("auto_syndication.webinar_sync_failed", { webinarId, error });
    return { ok: false };
  }
}

/**
 * Synchronizes a Resource to the News Feed.
 */
export async function syncResourceToActualites(
  resourceId: string,
  options?: { isFeatured?: boolean }
): Promise<{ ok: boolean; newsPostId?: string }> {
  try {
    const [res] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    if (!res) return { ok: false };

    const newsSlug = `ressource-${res.slug}`;
    const shouldBeFeatured = options?.isFeatured ?? false;
    const isPublished = Boolean(res.published);

    const syndicatedPost = await db.transaction(async (tx) => {
      if (shouldBeFeatured && isPublished) {
        await tx
          .update(newsPosts)
          .set({ isFeatured: false })
          .where(eq(newsPosts.isFeatured, true));
      }

      const [existing] = await tx
        .select()
        .from(newsPosts)
        .where(eq(newsPosts.slug, newsSlug))
        .limit(1);

      const contentFr = `
<div class="space-y-6">
  <p class="text-lg text-slate-700 leading-relaxed font-normal">${res.descriptionFr}</p>
  <div class="pt-6 border-t border-slate-200">
    <a href="/fr/ressources" class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold transition-all">
      <span>Consulter et télécharger la ressource</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</div>
`.trim();

      const contentAr = `
<div class="space-y-6" dir="rtl">
  <p class="text-lg text-slate-700 leading-relaxed font-normal">${res.descriptionAr}</p>
  <div class="pt-6 border-t border-slate-200">
    <a href="/ar/ressources" class="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold transition-all">
      <span>الاطلاع على المورد البيداغوجي وتحميله</span>
      <span aria-hidden="true">←</span>
    </a>
  </div>
</div>
`.trim();

      if (existing) {
        const [updated] = await tx
          .update(newsPosts)
          .set({
            category: "COMMUNIQUE",
            tagFr: "Ressource pédagogique",
            tagAr: "مورد بيداغوجي",
            titleFr: `Nouvelle ressource : ${res.titleFr}`,
            titleAr: `مورد بيداغوجي جديد: ${res.titleAr}`,
            excerptFr: res.descriptionFr.slice(0, 300),
            excerptAr: res.descriptionAr.slice(0, 300),
            contentFr,
            contentAr,
            coverImageUrl: resolveCoverImageUrl(res.coverImage),
            isFeatured: shouldBeFeatured && isPublished,
            published: isPublished,
            publishedAt: isPublished ? (existing.publishedAt || new Date()) : null,
            updatedAt: new Date(),
          })
          .where(eq(newsPosts.id, existing.id))
          .returning();
        return updated;
      } else {
        const [inserted] = await tx
          .insert(newsPosts)
          .values({
            slug: newsSlug,
            category: "COMMUNIQUE",
            tagFr: "Ressource pédagogique",
            tagAr: "مورد بيداغوجي",
            titleFr: `Nouvelle ressource : ${res.titleFr}`,
            titleAr: `مورد بيداغوجي جديد: ${res.titleAr}`,
            excerptFr: res.descriptionFr.slice(0, 300),
            excerptAr: res.descriptionAr.slice(0, 300),
            contentFr,
            contentAr,
            coverImageUrl: resolveCoverImageUrl(res.coverImage),
            isFeatured: shouldBeFeatured && isPublished,
            published: isPublished,
            publishedAt: isPublished ? new Date() : null,
          })
          .returning();
        return inserted;
      }
    });

    revalidateAllPublicFeeds();
    return { ok: true, newsPostId: syndicatedPost?.id };
  } catch (error) {
    logger.error("auto_syndication.resource_sync_failed", { resourceId, error });
    return { ok: false };
  }
}

/**
 * Removes or unpublishes a syndicated news post if the source course is deleted.
 */
export async function deleteSyndicatedCourseNews(courseSlug: string): Promise<void> {
  try {
    const newsSlug = `formation-${courseSlug}`;
    await db.delete(newsPosts).where(eq(newsPosts.slug, newsSlug));
    revalidateAllPublicFeeds();
  } catch (error) {
    logger.error("auto_syndication.course_delete_failed", { courseSlug, error });
  }
}
