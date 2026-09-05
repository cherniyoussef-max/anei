import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { lessons } from "@/server/db/schema";
import { getLessonCheckpoints } from "@/server/services/video-checkpoints";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCheckpointForm } from "@/components/admin/AdminCheckpointForm";
import { AdminCheckpointDeleteButton } from "@/components/admin/AdminCheckpointDeleteButton";

export const dynamic = "force-dynamic";

function timeLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default async function AdminLessonCheckpointsPage({ params }: { params: Promise<{ locale: string; id: string; lessonId: string }> }) {
  const { locale, id, lessonId } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "courses.update");
  const ar = locale === "ar";
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) notFound();
  const checkpoints = await getLessonCheckpoints(lessonId);

  return <>
    <AdminPageHeader
      locale={locale}
      eyebrow={ar ? "الدروس" : "Leçons"}
      title={ar ? `نقاط التفاعل: ${lesson.titleAr}` : `Checkpoints : ${lesson.titleFr}`}
      description={ar ? `مدة الدرس: ${timeLabel(lesson.durationSeconds)}. أضف نقاط توقف للتأمل أو أسئلة سريعة أثناء الفيديو، أو اختبارًا تكوينيًا بعد نهايته.` : `Durée de la leçon : ${timeLabel(lesson.durationSeconds)}. Ajoutez des pauses de réflexion ou des questions rapides pendant la vidéo, ou un quiz formatif après sa fin.`}
      actions={<Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/courses/editor/${id}?section=lessons`}>{ar ? "الرجوع إلى الدروس" : "Retour aux leçons"}</Link>}
    />

    <section className="admin-surface">
      <h2>{ar ? "إضافة نقطة تفاعل" : "Ajouter un checkpoint"}</h2>
      <p className="small-muted">{ar ? `اضبط الثواني بين 0 و${lesson.durationSeconds} لنقطة داخل الفيديو، أو ${lesson.durationSeconds} أو أكثر لاختبار بعد نهاية الفيديو.` : `Réglez les secondes entre 0 et ${lesson.durationSeconds} pour une pause en cours de vidéo, ou ${lesson.durationSeconds} et plus pour un quiz après la fin.`}</p>
      <AdminCheckpointForm locale={locale} lessonId={lessonId} durationSeconds={lesson.durationSeconds} />
    </section>

    <section className="admin-surface">
      <h2>{ar ? "نقاط التفاعل الحالية" : "Checkpoints existants"}</h2>
      {checkpoints.length ? <div className="admin-compact-list">{checkpoints.map((checkpoint) => <div key={checkpoint.id}>
        <div>
          <strong dir="ltr">{timeLabel(checkpoint.triggerSeconds)}{checkpoint.triggerSeconds >= lesson.durationSeconds ? ` · ${ar ? "بعد الفيديو" : "post-vidéo"}` : ""}</strong>
          <small>{checkpoint.kind === "QUIZ" ? (ar ? "سؤال اختيار" : "Question à choix") : (ar ? "تأمل" : "Réflexion")} — {ar ? checkpoint.promptAr : checkpoint.promptFr}</small>
        </div>
        <AdminCheckpointDeleteButton locale={locale} lessonId={lessonId} checkpointId={checkpoint.id} />
      </div>)}</div> : <div className="admin-empty-state"><strong>{ar ? "لا توجد نقاط تفاعل بعد" : "Aucun checkpoint pour le moment"}</strong></div>}
    </section>
  </>;
}
