import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminAssessmentAnalytics } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminAssessmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); await requireAdminPermission(locale, "results.read");
  const data = await getAdminAssessmentAnalytics(); const ar = locale === "ar";

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "التعلّم" : "Apprentissage"} title={ar ? "التقييمات والنتائج" : "Évaluations & résultats"} description={ar ? "راجع جاهزية الاختبارات والنتائج الموثوقة المحسوبة على الخادم." : "Suivez la préparation des quiz et les résultats fiables calculés par le serveur."} actions={<Link className="admin-primary-button" href={`/${locale}/admin/courses/editor`}>{ar ? "فتح محرر الدورات" : "Ouvrir l’éditeur"}</Link>}/>
    <section className="admin-kpi-grid assessment-admin-kpis" aria-label={ar ? "ملخص النتائج" : "Synthèse des résultats"}>
      <article><span>{ar ? "الاختبارات" : "Quiz"}</span><strong>{data.summary.assessments}</strong><small>{ar ? "جميع الاختبارات" : "tous les quiz"}</small></article>
      <article><span>{ar ? "المحاولات" : "Tentatives"}</span><strong>{data.summary.attempts}</strong><small>{ar ? "تم تصحيحها" : "notées"}</small></article>
      <article><span>{ar ? "متوسط النتيجة" : "Score moyen"}</span><strong>{data.summary.average_score}%</strong><small>{ar ? "جميع المحاولات" : "toutes tentatives"}</small></article>
      <article><span>{ar ? "نسبة النجاح" : "Taux de réussite"}</span><strong>{data.summary.pass_rate}%</strong><small>{ar ? "محسوبة على الخادم" : "calcul serveur"}</small></article>
    </section>

    <section className="admin-surface assessment-admin-section" aria-labelledby="assessment-overview-title">
      <header><div><span>{ar ? "نظرة عامة" : "Vue d’ensemble"}</span><h2 id="assessment-overview-title">{ar ? "الأداء حسب التقييم" : "Performance par évaluation"}</h2></div><p>{ar ? `أحدث ${data.scope.assessmentLimit} تقييماً؛ المؤشرات العليا تشمل جميع البيانات.` : `${data.scope.assessmentLimit} évaluations les plus récentes ; la synthèse couvre toutes les données.`}</p></header>
      {data.assessments.length ? <div className="admin-table-scroll"><table className="admin-data-table assessment-results-table"><thead><tr><th>{ar ? "التقييم" : "Évaluation"}</th><th>{ar ? "المشاركون" : "Participants"}</th><th>{ar ? "المحاولات" : "Tentatives"}</th><th>{ar ? "المتوسط" : "Score moyen"}</th><th>{ar ? "نسبة النجاح" : "Réussite"}</th><th>{ar ? "أفضل نتيجة" : "Meilleur score"}</th><th>{ar ? "الحالة" : "Statut"}</th></tr></thead><tbody>{data.assessments.map((row) => <tr key={row.id}><td><strong>{ar ? row.title_ar : row.title_fr}</strong><small className="admin-cell-subtitle">{ar ? row.course_title_ar : row.course_title_fr} · {row.questions} {ar ? "أسئلة" : "questions"}</small></td><td>{row.participants}</td><td>{row.attempts}</td><td>{row.attempts ? `${row.average_score}%` : "-"}</td><td>{row.attempts ? `${row.pass_rate}%` : "-"}</td><td>{row.attempts ? `${row.best_score}%` : "-"}</td><td><span className={`admin-status ${row.published ? "is-success" : "is-neutral"}`}>{row.published ? (ar ? "منشور" : "Publié") : (ar ? "مسودة" : "Brouillon")}</span></td></tr>)}</tbody></table></div> : <div className="admin-empty-state"><strong>{ar ? "لا توجد تقييمات" : "Aucune évaluation"}</strong><p>{ar ? "أنشئ اختباراً من محرر الدورة." : "Créez un quiz depuis l’éditeur de cours."}</p></div>}
    </section>

    <section className="admin-surface assessment-admin-section" aria-labelledby="student-results-title">
      <header><div><span>{ar ? "المتعلمون" : "Apprenants"}</span><h2 id="student-results-title">{ar ? "نتائج المتعلمين" : "Résultats des apprenants"}</h2></div><p>{ar ? "أفضل وآخر نتيجة لكل متعلم وتقييم." : "Meilleur et dernier score par apprenant et par évaluation."}</p></header>
      {data.students.length ? <div className="admin-table-scroll"><table className="admin-data-table assessment-results-table"><thead><tr><th>{ar ? "المتعلم" : "Apprenant"}</th><th>{ar ? "التقييم" : "Évaluation"}</th><th>{ar ? "المحاولات" : "Tentatives"}</th><th>{ar ? "أفضل نتيجة" : "Meilleur score"}</th><th>{ar ? "آخر نتيجة" : "Dernier score"}</th><th>{ar ? "النتيجة" : "Résultat"}</th><th>{ar ? "اكتمل في" : "Terminé le"}</th></tr></thead><tbody>{data.students.map((row) => <tr key={`${row.assessment_id}:${row.user_id}`}><td><strong>{row.student_name}</strong><small className="admin-cell-subtitle">{row.student_email}</small></td><td>{ar ? row.assessment_title_ar : row.assessment_title_fr}</td><td>{row.attempts}</td><td><strong>{row.best_score}%</strong></td><td>{row.latest_score}%</td><td><span className={`admin-status ${row.latest_passed ? "is-success" : "is-danger"}`}>{row.latest_passed ? (ar ? "ناجح" : "Réussie") : (ar ? "غير ناجح" : "Non réussie")}</span></td><td>{formatDate(row.completed_at, locale)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state"><strong>{ar ? "لا توجد نتائج بعد" : "Aucun résultat pour le moment"}</strong><p>{ar ? "ستظهر المحاولات المصححة هنا." : "Les tentatives notées apparaîtront ici."}</p></div>}
    </section>
  </>;
}
