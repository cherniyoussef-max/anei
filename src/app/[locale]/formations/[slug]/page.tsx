import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { getCourseVisual } from "@/lib/visuals";
import { CheckoutButton } from "@/components/commerce/CheckoutButton";
import { getPublishedCourse } from "@/server/queries/catalog";
import { getPaymentCapabilities } from "@/server/payments";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { enrollments } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublishedCourse(slug);
  if (!result) notFound();
  const { course, lessons, modules } = result;
  const ar = locale === "ar";
  const title = ar ? course.titleAr : course.titleFr;
  const description = ar ? course.descriptionAr : course.descriptionFr;
  const objectives = course.objectives[locale];
  const session = await getSession();
  let enrolled = false;
  if (session) {
    const [row] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.userId, session.user.id), eq(enrollments.courseId, course.id))).limit(1);
    enrolled = Boolean(row);
  }
  const preview = lessons.find((lesson) => lesson.preview && lesson.videoUrl);
  const moduleGroups = modules.map((courseModule) => ({ module: courseModule, lessons: lessons.filter((lesson) => lesson.moduleId === courseModule.id) })).filter((group) => group.lessons.length);
  const ungrouped = lessons.filter((lesson) => !lesson.moduleId || !modules.some((courseModule) => courseModule.id === lesson.moduleId));

  return <>
    <section className="course-detail-hero"><div className="container course-detail-grid">
      <div className="course-detail-copy"><Link className="back-link" href={`/${locale}/formations`}>← {ar ? "كل الدورات" : "Toutes les formations"}</Link><div className="course-detail-labels"><span>{course.category}</span><span>{course.mode}</span><span>{course.level}</span></div><h1>{title}</h1><p>{description}</p><div className="course-info-row"><span><Icon name="clock" size={18}/>{Math.round(course.durationMinutes / 60)} h</span>{course.startAt ? <span><Icon name="calendar" size={18}/>{formatDate(course.startAt, locale)}</span> : null}<span><Icon name="user" size={18}/>{course.trainerName}</span></div></div>
      <aside className="enroll-card premium-card enroll-card-human"><div className="enroll-photo"><Image src={getCourseVisual(course.slug)} alt="" fill sizes="(max-width: 900px) 100vw, 360px"/><div className="enroll-photo-overlay" aria-hidden="true"/><span><Icon name="graduation" size={16}/>{ar ? "مسار مهني" : "Parcours professionnel"}</span></div><div className="price-stack"><small>{ar ? "سعر المسار" : "Tarif du parcours"}</small><strong className="enroll-price">{formatMillimes(course.priceMillimes, locale)}</strong></div>{enrolled ? <Link className="btn btn-primary btn-block" href={`/${locale}/apprendre/${course.slug}`}><Icon name="play" size={18}/>{ar ? "متابعة الدورة" : "Continuer la formation"}</Link> : <CheckoutButton itemType="course" itemId={course.id} locale={locale} capabilities={getPaymentCapabilities()} label={course.priceMillimes === 0 ? (ar ? "الالتحاق مجانًا" : "Accéder gratuitement") : (ar ? "التسجيل والدفع" : "S’inscrire et payer")}/>}<p className="small-muted"><Icon name="shield" size={15}/>{ar ? "يُفعّل الوصول فقط بعد تأكيد الدفع على الخادم" : "Accès activé uniquement après validation serveur du paiement"}</p></aside>
    </div></section>

    {preview ? <section className="section section-tight"><div className="container preview-showcase"><div><span className="eyebrow">{ar ? "معاينة مجانية" : "Aperçu gratuit"}</span><h2>{ar ? "شاهد نموذجًا من تجربة التعلم" : "Découvrez l’expérience avant de vous inscrire"}</h2><p>{ar ? "هذه معاينة محددة من المسار؛ الوصول الكامل يخضع للتسجيل وحقوق المحتوى." : "Cet aperçu est volontairement limité ; le parcours complet reste protégé par l’inscription et les droits d’accès."}</p></div><video className="preview-video" controls preload="metadata" poster="/demo/video-poster.svg"><source src={preview.videoUrl!} type="video/mp4"/></video></div></section> : null}

    <section className="section"><div className="container detail-content-grid"><article className="prose-card"><span className="eyebrow">{ar ? "الأهداف" : "Objectifs pédagogiques"}</span><h2>{ar ? "في نهاية المسار ستكون قادرًا على" : "À l’issue du parcours, vous saurez"}</h2><ul className="check-list">{objectives.map((objective) => <li key={objective}><span><Icon name="check" size={16}/></span>{objective}</li>)}</ul><h2>{ar ? "البرنامج" : "Programme"}</h2>
      <div className="course-program-modules">{moduleGroups.map(({ module, lessons: moduleLessons }) => <section className="course-program-module" key={module.id}><header><span>{ar ? `الوحدة ${module.position}` : `Module ${module.position}`}</span><h3>{ar ? module.titleAr : module.titleFr}</h3><p>{ar ? module.descriptionAr : module.descriptionFr}</p></header><div className="module-list">{moduleLessons.map((lesson) => <div key={lesson.id}><span>{lesson.position}</span><strong>{ar ? lesson.titleAr : lesson.titleFr}</strong><small>{Math.max(1, Math.round(lesson.durationSeconds / 60))} min {lesson.preview ? `· ${ar ? "معاينة" : "aperçu"}` : ""}</small></div>)}</div></section>)}{ungrouped.length ? <section className="course-program-module"><header><h3>{ar ? "دروس إضافية" : "Leçons complémentaires"}</h3></header><div className="module-list">{ungrouped.map((lesson) => <div key={lesson.id}><span>{lesson.position}</span><strong>{ar ? lesson.titleAr : lesson.titleFr}</strong><small>{Math.max(1, Math.round(lesson.durationSeconds / 60))} min</small></div>)}</div></section> : null}</div>
    </article><aside className="detail-aside"><div className="info-card"><h3>{ar ? "يشمل المسار" : "Inclus"}</h3><p><Icon name="play" size={18}/>{ar ? "فيديوهات ودروس منظمة" : "Vidéos et leçons structurées"}</p><p><Icon name="book" size={18}/>{ar ? "وثائق وموارد" : "Documents et ressources"}</p><p><Icon name="chart" size={18}/>{ar ? "حفظ التقدم تلقائيًا" : "Progression sauvegardée"}</p><p><Icon name="award" size={18}/>{ar ? "شهادة عند الإتمام" : "Certificat à la réussite"}</p></div></aside></div></section>
  </>;
}
