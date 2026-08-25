import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminAssessmentList, getAdminResultList } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";
export default async function AdminAssessmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); await requireAdminPermission(locale, "results.read");
  const [assessments, results] = await Promise.all([getAdminAssessmentList(), getAdminResultList()]); const ar = locale === "ar";
  const graded = results.length; const passed = results.filter((row)=>row.attempt.passed).length; const avg = graded ? Math.round(results.reduce((sum,row)=>sum+(row.attempt.percentage??0),0)/graded) : 0;
  return <><AdminPageHeader locale={locale} eyebrow={ar?"التعلّم":"Apprentissage"} title={ar?"التقييمات والنتائج":"Évaluations & résultats"} description={ar?"أنشئ اختبارات آمنة وراجع النتائج المحسوبة على الخادم.":"Créez des quiz sécurisés et analysez les résultats calculés par le serveur."} actions={<Link className="admin-primary-button" href={`/${locale}/admin/courses/editor`}>{ar?"فتح محرر الدورات":"Ouvrir l’éditeur"}</Link>}/>
    <section className="admin-kpi-grid"><article><span>{ar?"الاختبارات":"Quiz"}</span><strong>{assessments.length}</strong><small>{ar?"إجمالي":"total"}</small></article><article><span>{ar?"المحاولات المصححة":"Tentatives notées"}</span><strong>{graded}</strong><small>{ar?"محاولات":"tentatives"}</small></article><article><span>{ar?"متوسط النتيجة":"Score moyen"}</span><strong>{avg}%</strong><small>{ar?"محسوب على الخادم":"calcul serveur"}</small></article><article><span>{ar?"النجاح":"Réussites"}</span><strong>{passed}</strong><small>{graded?`${Math.round(passed/graded*100)}%`:"—"}</small></article></section>
    <div className="admin-dashboard-grid"><section className="admin-surface"><header><div><span>{ar?"التكوين":"Configuration"}</span><h2>{ar?"الاختبارات":"Quiz"}</h2></div></header><div className="admin-list">{assessments.map((row)=><article key={row.assessment.id}><div><strong>{ar?row.assessment.titleAr:row.assessment.titleFr}</strong><small>{ar?row.course.titleAr:row.course.titleFr} · {row.questions} {ar?"أسئلة":"questions"}</small></div><span className={`admin-status ${row.assessment.published?"is-success":"is-neutral"}`}>{row.assessment.published?(ar?"منشور":"Publié"):(ar?"مسودة":"Brouillon")}</span></article>)}{!assessments.length?<p className="admin-empty">{ar?"لا توجد اختبارات.":"Aucun quiz."}</p>:null}</div></section>
    <section className="admin-surface"><header><div><span>{ar?"النتائج":"Résultats"}</span><h2>{ar?"أحدث المحاولات":"Dernières tentatives"}</h2></div></header><div className="admin-list">{results.map((row)=><article key={row.attempt.id}><div><strong>{row.student.name}</strong><small>{ar?row.assessment.titleAr:row.assessment.titleFr} · {row.attempt.submittedAt?formatDate(row.attempt.submittedAt,locale):"—"}</small></div><b>{row.attempt.percentage}% · {row.attempt.passed?(ar?"ناجح":"Réussi"):(ar?"غير ناجح":"Non réussi")}</b></article>)}{!results.length?<p className="admin-empty">{ar?"لا توجد نتائج بعد.":"Aucun résultat pour le moment."}</p>:null}</div></section></div>
  </>;
}
