import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  courses,
  courseModules,
  enrollments,
  learningAssessment,
  learningQuestion,
  lessonProgress,
  lessons,
} from "@/server/db/schema";

export interface LearnerCourseSummary {
  courseId: string;
  slug: string;
  titleFr: string;
  titleAr: string;
  category: string;
  progressPercent: number;
  status: string;
  enrolledAt: Date;
  modules: {
    id: string;
    position: number;
    titleFr: string;
    titleAr: string;
    lessons: {
      id: string;
      position: number;
      titleFr: string;
      titleAr: string;
      durationSeconds: number;
      isCompleted: boolean;
    }[];
  }[];
  assessments: {
    id: string;
    titleFr: string;
    titleAr: string;
    passingScore: number;
    questionsCount: number;
    keyLearningPointsFr: string[];
    keyLearningPointsAr: string[];
  }[];
}

// In-memory 3-minute cache per user to maintain high performance
const cache = new Map<string, { data: string; expiresAt: number }>();

export async function getLearnerCourseAiContext(userId: string, locale: "fr" | "ar" = "fr"): Promise<string> {
  const cacheKey = `${userId}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const userEnrollments = await db
      .select({
        enrollmentId: enrollments.id,
        courseId: enrollments.courseId,
        progressPercent: enrollments.progressPercent,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        slug: courses.slug,
        titleFr: courses.titleFr,
        titleAr: courses.titleAr,
        category: courses.category,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(5);

    if (userEnrollments.length === 0) {
      return "";
    }

    const courseIds = userEnrollments.map((e) => e.courseId);
    const enrollmentIds = userEnrollments.map((e) => e.enrollmentId);

    const [modulesRows, lessonsRows, progressRows, assessmentRows] = await Promise.all([
      db
        .select({
          id: courseModules.id,
          courseId: courseModules.courseId,
          position: courseModules.position,
          titleFr: courseModules.titleFr,
          titleAr: courseModules.titleAr,
        })
        .from(courseModules)
        .where(inArray(courseModules.courseId, courseIds))
        .orderBy(asc(courseModules.position)),
      db
        .select({
          id: lessons.id,
          courseId: lessons.courseId,
          moduleId: lessons.moduleId,
          position: lessons.position,
          titleFr: lessons.titleFr,
          titleAr: lessons.titleAr,
          durationSeconds: lessons.durationSeconds,
        })
        .from(lessons)
        .where(inArray(lessons.courseId, courseIds))
        .orderBy(asc(lessons.position)),
      db
        .select({
          enrollmentId: lessonProgress.enrollmentId,
          lessonId: lessonProgress.lessonId,
        })
        .from(lessonProgress)
        .where(inArray(lessonProgress.enrollmentId, enrollmentIds)),
      db
        .select({
          id: learningAssessment.id,
          courseId: learningAssessment.courseId,
          titleFr: learningAssessment.titleFr,
          titleAr: learningAssessment.titleAr,
          passingScore: learningAssessment.passingScore,
        })
        .from(learningAssessment)
        .where(and(inArray(learningAssessment.courseId, courseIds), eq(learningAssessment.published, true))),
    ]);

    const completedLessonIds = new Set(progressRows.map((r) => r.lessonId));

    // Load question key learning concepts for assessments
    const assessmentIds = assessmentRows.map((a) => a.id);
    const questionsRows = assessmentIds.length > 0
      ? await db
          .select({
            id: learningQuestion.id,
            assessmentId: learningQuestion.assessmentId,
            promptFr: learningQuestion.promptFr,
            promptAr: learningQuestion.promptAr,
            explanationFr: learningQuestion.explanationFr,
            explanationAr: learningQuestion.explanationAr,
          })
          .from(learningQuestion)
          .where(inArray(learningQuestion.assessmentId, assessmentIds))
          .orderBy(asc(learningQuestion.position))
      : [];

    const isAr = locale === "ar";
    let formattedContext = "";

    if (isAr) {
      formattedContext = `\n==================================================\n`;
      formattedContext += `🎓 الدورات التكوينية التي اشتراها / سجل بها هذا المتعلّم في حسابه :\n`;
      formattedContext += `==================================================\n`;
      formattedContext += `المستخدم مسجل رسمياً في الدورات التالية ولديه وصول كامل لمحتواها واختباراتها :\n\n`;

      for (const e of userEnrollments) {
        formattedContext += `📘 الدورة: ${e.titleAr} (${e.titleFr})\n`;
        formattedContext += `- الرابط المباشر: /ar/apprendre/${e.slug}\n`;
        formattedContext += `- نسبة التقدم الحالية: ${e.progressPercent}%\n`;

        const cModules = modulesRows.filter((m) => m.courseId === e.courseId);
        if (cModules.length > 0) {
          formattedContext += `- المنهاج والوحدات الدراسية:\n`;
          for (const m of cModules) {
            formattedContext += `  * الوحدة ${m.position}: ${m.titleAr}\n`;
            const mLessons = lessonsRows.filter((l) => l.moduleId === m.id);
            for (const l of mLessons) {
              const doneMark = completedLessonIds.has(l.id) ? "✓ مكتمل" : "○ قيد المتابعة";
              formattedContext += `    - درس ${l.position}: ${l.titleAr} [${doneMark}]\n`;
            }
          }
        }

        const cAssessments = assessmentRows.filter((a) => a.courseId === e.courseId);
        if (cAssessments.length > 0) {
          formattedContext += `- الاختبار والتقييم النهائي للشهادة:\n`;
          for (const a of cAssessments) {
            const aQuestions = questionsRows.filter((q) => q.assessmentId === a.id);
            formattedContext += `  * ${a.titleAr} (نسبة النجاح المطلوبة: ${a.passingScore}% - عدد الأسئلة: ${aQuestions.length})\n`;
            formattedContext += `  * المفاهيم الجوهرية للاختبار للمساعدة على المراجعة والنجاح:\n`;
            for (const q of aQuestions.slice(0, 15)) {
              if (q.explanationAr || q.promptAr) {
                formattedContext += `    • ${q.promptAr}: ${q.explanationAr || ""}\n`;
              }
            }
          }
        }
        formattedContext += `\n`;
      }

      formattedContext += `\nتعليمات خاصة لهذا المتعلّم:\n`;
      formattedContext += `1. اعترف فوراً بالدورة التي سجل بها وتحدث معه كمرشد بيداغوجي يشرف على تكوينه.\n`;
      formattedContext += `2. إذا سأل عن دروسه، اشرح له بالرجوع لوحدات دورته بالتحديد.\n`;
      formattedContext += `3. إذا سأل كيف يجتاز الاختبار النهائي أو يراجع للشهادة، قدّم له مراجعة مركزة للمفاهيم المذكورة أعلاه، واشرح له أسباب الإجابات الصحيحة ونقاط القوة دون إعطائه حلولاً جاهزة حرفية، بل درّبه بأسئلة تفاعلية ذكية حتى يفهم ويحصل على أكثر من 80%!\n`;
    } else {
      formattedContext = `\n==================================================\n`;
      formattedContext += `🎓 FORMATIONS ACHETÉES & CURSUS ACTIF DE CET APPRENANT :\n`;
      formattedContext += `==================================================\n`;
      formattedContext += `L'utilisateur connecté est officiellement inscrit aux formations certifiantes suivantes :\n\n`;

      for (const e of userEnrollments) {
        formattedContext += `📘 Formation : ${e.titleFr} (${e.titleAr})\n`;
        formattedContext += `- Accès direct au lecteur : /fr/apprendre/${e.slug}\n`;
        formattedContext += `- Progression actuelle : ${e.progressPercent}%\n`;

        const cModules = modulesRows.filter((m) => m.courseId === e.courseId);
        if (cModules.length > 0) {
          formattedContext += `- Curriculum & Modules détaillés :\n`;
          for (const m of cModules) {
            formattedContext += `  * Module ${m.position} : ${m.titleFr}\n`;
            const mLessons = lessonsRows.filter((l) => l.moduleId === m.id);
            for (const l of mLessons) {
              const doneMark = completedLessonIds.has(l.id) ? "✓ Complété" : "○ À suivre";
              formattedContext += `    - Leçon ${l.position} : ${l.titleFr} [${doneMark}]\n`;
            }
          }
        }

        const cAssessments = assessmentRows.filter((a) => a.courseId === e.courseId);
        if (cAssessments.length > 0) {
          formattedContext += `- Évaluation & Examen Certifiant :\n`;
          for (const a of cAssessments) {
            const aQuestions = questionsRows.filter((q) => q.assessmentId === a.id);
            formattedContext += `  * ${a.titleFr} (Score requis pour la certification : ${a.passingScore}% - Total questions : ${aQuestions.length})\n`;
            formattedContext += `  * Concepts cliniques et pédagogiques clés évalués dans le test :\n`;
            for (const q of aQuestions.slice(0, 15)) {
              if (q.explanationFr || q.promptFr) {
                formattedContext += `    • ${q.promptFr} => Justification pédagogique : ${q.explanationFr || ""}\n`;
              }
            }
          }
        }
        formattedContext += `\n`;
      }

      formattedContext += `\nCONSIGNES DU TUTEUR POUR CET APPRENANT :\n`;
      formattedContext += `1. Vous connaissez parfaitement ses cours et son état d'avancement. Saluez-le chaleureusement en mentionnant sa formation active.\n`;
      formattedContext += `2. S'il demande des explications sur un module ou une leçon, fournissez une réponse structurée, pédagogique et bienveillante basée sur le contenu exact de sa formation.\n`;
      formattedContext += `3. S'il prépare son test ou son évaluation certifiante, aidez-le à maîtriser les notions évaluées ci-dessus : expliquez les mécanismes (ex: dyade DSM-5, attention conjointe, structuration TEACCH, grille ABC, posture AVS), donnez-lui des synthèses mnémotechniques, et testez sa compréhension avec des questions d'entraînement stimulantes pour qu'il obtienne plus de 80% et débloque son certificat ANEI avec brio !\n`;
    }

    cache.set(cacheKey, { data: formattedContext, expiresAt: Date.now() + 3 * 60 * 1000 });
    return formattedContext;
  } catch (error) {
    console.error("[getLearnerCourseAiContext] Error:", error);
    return "";
  }
}
