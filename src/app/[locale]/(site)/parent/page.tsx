import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent, getLinkedStudentsProgressForParent } from "@/server/queries/relationships";
import { Icon } from "@/components/ui/Icon";

export default async function ParentPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");
  const [linkedStudents, progressRows] = await Promise.all([
    getLinkedStudentsForParent(session.user.id),
    getLinkedStudentsProgressForParent(session.user.id),
  ]);

  // Group the bounded progress rows per child for display.
  const progressByStudent = new Map<string, { studentName: string; items: { title: string; progressPercent: number }[] }>();
  for (const row of progressRows) {
    const entry = progressByStudent.get(row.studentId) ?? { studentName: row.studentName, items: [] };
    if (!progressByStudent.has(row.studentId)) progressByStudent.set(row.studentId, entry);
    entry.items.push({ title: ar ? row.courseTitleAr : row.courseTitleFr, progressPercent: row.progressPercent });
  }

  return (
    <>
      <div className="dashboard-heading dashboard-heading-human">
        <div className="dashboard-heading-copy">
          <span className="eyebrow">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
          <h1>{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
          <p>{ar ? "تابع مسار أبنائك المرتبطين بحسابك." : "Suivez le parcours des enfants liés à votre compte."}</p>
        </div>
      </div>

      <div className="dashboard-kpis">
        <div>
          <div className="kpi-icon"><Icon name="users" size={18} /></div>
          <div><strong>{linkedStudents.length}</strong><small>{ar ? "الأبناء المرتبطون" : "Enfants liés"}</small></div>
        </div>
      </div>

      <div className="dashboard-panel wide">
        <div className="panel-head">
          <h2>{ar ? "أبنائي" : "Mes enfants"}</h2>
          {linkedStudents.length > 0 && (
            <Link href={`/${locale}/parent/enfants`}>{ar ? "عرض التفاصيل" : "Voir le détail"}</Link>
          )}
        </div>
        {linkedStudents.length === 0 ? (
          <p className="dashboard-empty-copy">
            {ar
              ? "لا يوجد بعد أي طفل مرتبط بحسابك. يمكنكم التواصل مع فريق الأكاديمية لربط أبنائكم بشكل آمن بعد التحقق."
              : "Aucun enfant n'est encore associé à votre compte. Vous pourrez associer votre enfant depuis votre espace Parent après vérification par l'équipe ANEI — contactez l'Académie pour lancer cette démarche sécurisée."}
          </p>
        ) : (
          <ul className="learning-list">
            {linkedStudents.map(({ link, student }) => {
              const progress = progressByStudent.get(student.id);
              return (
                <li key={link.id} className="learning-row">
                  <div className="learning-icon"><Icon name="user" size={18} /></div>
                  <div className="learning-main">
                    <strong>{student.name}</strong>
                    <small>{ar ? "الصلة" : "Relation"}: {link.relationshipType}</small>
                    {progress && progress.items.length > 0 ? (
                      <div className="learning-progress-list">
                        {progress.items.map((item, index) => (
                          <div key={index} className="learning-progress-item">
                            <span className="learning-progress-title">{item.title}</span>
                            <span
                              className="learning-progress-badge"
                              role="status"
                              aria-label={`${item.title} — ${item.progressPercent}%`}
                            >
                              {item.progressPercent}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <small className="learning-progress-none">
                        {ar ? "لا يوجد تسجيل في دورة بعد." : "Aucune inscription à un cours pour le moment."}
                      </small>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
