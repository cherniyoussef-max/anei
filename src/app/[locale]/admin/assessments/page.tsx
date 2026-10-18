import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminAssessmentAnalytics } from "@/modules/admin/queries/admin-learning";
import { getAdminAssessmentResults } from "@/server/services/learning-assessments";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSectionCard } from "@/modules/admin/components/AdminSectionCard";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

export const dynamic = "force-dynamic";

export default async function AdminAssessmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "results.read");
  const [data, recentSubmissions] = await Promise.all([
    getAdminAssessmentAnalytics(),
    getAdminAssessmentResults(30),
  ]);
  const ar = locale === "ar";

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "منظومة التعلّم" : "Apprentissage & Pédagogie"}
        title={ar ? "التقييمات والنتائج الأكاديمية" : "Évaluations & résultats"}
        description={
          ar
            ? "متابعة نتائج الاختبارات المحسوبة تلقائياً على الخادم لضمان المصداقية وتتبع مستويات المتعلمين."
            : "Suivez la préparation des quiz et les résultats fiables calculés par le serveur."
        }
        actions={
          <Link className="admin-primary-button" href={`/${locale}/admin/courses/editor`}>
            {ar ? "فتح محرر الدورات" : "Ouvrir l’éditeur"}
          </Link>
        }
      />

      <section className="admin-kpi-grid assessment-admin-kpis" aria-label={ar ? "ملخص النتائج" : "Synthèse des résultats"}>
        <article>
          <span>{ar ? "الاختبارات" : "Quiz"}</span>
          <strong>{data.summary.assessments}</strong>
          <small>{ar ? "جميع الاختبارات" : "tous les quiz"}</small>
        </article>
        <article>
          <span>{ar ? "المحاولات" : "Tentatives"}</span>
          <strong>{data.summary.attempts}</strong>
          <small>{ar ? "تم تصحيحها" : "notées"}</small>
        </article>
        <article>
          <span>{ar ? "متوسط النتيجة" : "Score moyen"}</span>
          <strong>{data.summary.average_score}%</strong>
          <small>{ar ? "جميع المحاولات" : "toutes tentatives"}</small>
        </article>
        <article>
          <span>{ar ? "نسبة النجاح" : "Taux de réussite"}</span>
          <strong>{data.summary.pass_rate}%</strong>
          <small>{ar ? "محسوبة على الخادم" : "calcul serveur"}</small>
        </article>
      </section>

      {/* Real-time submissions feed */}
      <AdminSectionCard
        title={ar ? "أحدث نتائج الاختبارات المستلمة" : "Dernières soumissions de quiz reçues"}
        subtitle={
          ar
            ? "سجل حي لجميع محاولات الاختبار المصححة مع النتائج المحسوبة وروابط دعم المتعلمين."
            : "Flux en temps réel de toutes les tentatives soumises avec scores calculés et accès aux fiches apprenants."
        }
        infoTooltip={ar ? "نتائج حية ومصححة خادمياً" : "Résultats notés côté serveur en temps réel"}
        bodyClassName="p-0"
      >
        {recentSubmissions.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table assessment-results-table">
              <thead>
                <tr>
                  <th>{ar ? "المتعلم" : "Apprenant"}</th>
                  <th>{ar ? "الدورة والاختبار" : "Formation & Quiz"}</th>
                  <th>{ar ? "المحاولة" : "Tentative"}</th>
                  <th>{ar ? "النتيجة" : "Score"}</th>
                  <th>{ar ? "الحالة" : "Résultat"}</th>
                  <th>{ar ? "تاريخ الإرسال" : "Date de soumission"}</th>
                  <th>{ar ? "الإجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {recentSubmissions.map((sub) => (
                  <tr key={sub.attempt.id}>
                    <td>
                      <strong className="text-slate-900 block">{sub.learner.name}</strong>
                      <small className="admin-cell-subtitle text-xs text-slate-500">{sub.learner.email}</small>
                    </td>
                    <td>
                      <strong className="text-slate-900 block">{ar ? sub.assessment.titleAr : sub.assessment.titleFr}</strong>
                      <small className="admin-cell-subtitle text-xs text-slate-500">{ar ? sub.course.titleAr : sub.course.titleFr}</small>
                    </td>
                    <td className="text-sm text-slate-600 font-mono">#{sub.attempt.attemptNumber}</td>
                    <td>
                      <strong className="text-slate-900 tabular-nums">{sub.attempt.percentage}%</strong>
                      <small className="admin-cell-subtitle text-xs text-slate-500 ms-1">({sub.attempt.rawPoints}/{sub.attempt.maxPoints} pts)</small>
                    </td>
                    <td>
                      <span className={`admin-status ${sub.attempt.passed ? "is-success" : "is-danger"}`}>
                        {sub.attempt.passed ? (ar ? "ناجح" : "Réussi") : (ar ? "غير ناجح" : "Non réussi")}
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{sub.attempt.submittedAt ? formatDate(sub.attempt.submittedAt, locale) : "—"}</td>
                    <td>
                      <Link
                        href={`/${locale}/admin/users/${sub.learner.id}?tab=learning`}
                        className="admin-secondary-button"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        title={ar ? "عرض ملف المتعلم ودعمه" : "Consulter et assister l'apprenant"}
                      >
                        {ar ? "ملف المتعلم" : "Fiche apprenant"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state p-8 text-center">
            <strong className="text-slate-800">{ar ? "لا توجد نتائج مسلّمة بعد" : "Aucune soumission pour le moment"}</strong>
            <p className="text-sm text-slate-500 mt-1">{ar ? "ستظهر نتائج الاختبارات فور تسليم المتعلمين لمحاولاتهم." : "Les résultats apparaîtront ici dès que des apprenants soumettront leurs quiz."}</p>
          </div>
        )}
      </AdminSectionCard>

      <AdminSectionCard
        title={ar ? "الأداء حسب التقييم" : "Performance par évaluation"}
        subtitle={ar ? `أحدث ${data.scope.assessmentLimit} تقييماً؛ المؤشرات العليا تشمل جميع البيانات.` : `${data.scope.assessmentLimit} évaluations les plus récentes ; la synthèse couvre toutes les données.`}
        bodyClassName="p-0"
      >
        {data.assessments.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table assessment-results-table">
              <thead>
                <tr>
                  <th>{ar ? "التقييم" : "Évaluation"}</th>
                  <th>{ar ? "المشاركون" : "Participants"}</th>
                  <th>{ar ? "المحاولات" : "Tentatives"}</th>
                  <th>{ar ? "المتوسط" : "Score moyen"}</th>
                  <th>{ar ? "نسبة النجاح" : "Réussite"}</th>
                  <th>{ar ? "أفضل نتيجة" : "Meilleur score"}</th>
                  <th>{ar ? "الحالة" : "Statut"}</th>
                </tr>
              </thead>
              <tbody>
                {data.assessments.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong className="text-slate-900 block">{ar ? row.title_ar : row.title_fr}</strong>
                      <small className="admin-cell-subtitle text-xs text-slate-500">{ar ? row.course_title_ar : row.course_title_fr} · {row.questions} {ar ? "أسئلة" : "questions"}</small>
                    </td>
                    <td className="tabular-nums text-slate-700">{row.participants}</td>
                    <td className="tabular-nums text-slate-700">{row.attempts}</td>
                    <td className="tabular-nums font-medium text-slate-900">{row.attempts ? `${row.average_score}%` : "-"}</td>
                    <td className="tabular-nums font-medium text-slate-900">{row.attempts ? `${row.pass_rate}%` : "-"}</td>
                    <td className="tabular-nums font-medium text-slate-900">{row.attempts ? `${row.best_score}%` : "-"}</td>
                    <td>
                      <span className={`admin-status ${row.published ? "is-success" : "is-neutral"}`}>
                        {row.published ? (ar ? "منشور" : "Publié") : (ar ? "مسودة" : "Brouillon")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state p-8 text-center">
            <strong className="text-slate-800">{ar ? "لا توجد تقييمات" : "Aucune évaluation"}</strong>
            <p className="text-sm text-slate-500 mt-1">{ar ? "أنشئ اختباراً من محرر الدورة." : "Créez un quiz depuis l’éditeur de cours."}</p>
          </div>
        )}
      </AdminSectionCard>

      <AdminSectionCard
        title={ar ? "نتائج المتعلمين" : "Résultats des apprenants"}
        subtitle={ar ? "أفضل وآخر نتيجة لكل متعلم وتقييم." : "Meilleur et dernier score par apprenant et par évaluation."}
        bodyClassName="p-0"
      >
        {data.students.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table assessment-results-table">
              <thead>
                <tr>
                  <th>{ar ? "المتعلم" : "Apprenant"}</th>
                  <th>{ar ? "التقييم" : "Évaluation"}</th>
                  <th>{ar ? "المحاولات" : "Tentatives"}</th>
                  <th>{ar ? "أفضل نتيجة" : "Meilleur score"}</th>
                  <th>{ar ? "آخر نتيجة" : "Dernier score"}</th>
                  <th>{ar ? "النتيجة" : "Résultat"}</th>
                  <th>{ar ? "اكتمل في" : "Terminé le"}</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row) => (
                  <tr key={`${row.assessment_id}:${row.user_id}`}>
                    <td>
                      <strong className="text-slate-900 block">{row.student_name}</strong>
                      <small className="admin-cell-subtitle text-xs text-slate-500">{row.student_email}</small>
                    </td>
                    <td className="text-slate-800">{ar ? row.assessment_title_ar : row.assessment_title_fr}</td>
                    <td className="tabular-nums text-slate-700">{row.attempts}</td>
                    <td className="tabular-nums font-semibold text-slate-900">{row.best_score}%</td>
                    <td className="tabular-nums text-slate-700">{row.latest_score}%</td>
                    <td>
                      <span className={`admin-status ${row.latest_passed ? "is-success" : "is-danger"}`}>
                        {row.latest_passed ? (ar ? "ناجح" : "Réussie") : (ar ? "غير ناجح" : "Non réussie")}
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{formatDate(row.completed_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state p-8 text-center">
            <strong className="text-slate-800">{ar ? "لا توجد نتائج بعد" : "Aucun résultat pour le moment"}</strong>
            <p className="text-sm text-slate-500 mt-1">{ar ? "ستظهر المحاولات المصححة هنا." : "Les tentatives notées apparaîtront ici."}</p>
          </div>
        )}
      </AdminSectionCard>

      <AdminFooter locale={locale} />
    </>
  );
}
