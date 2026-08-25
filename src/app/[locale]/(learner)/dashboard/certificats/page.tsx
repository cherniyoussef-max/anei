import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerCertificatesPage } from "@/server/queries/account";
import { LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default async function LearnerCertificatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const rows = await getLearnerCertificatesPage(session.user.id);
  return <div className="learner-page"><LearnerPageHeader title={ar ? "شهاداتي" : "Mes certificats"} description={ar ? "راجع إنجازاتك وافتح شهاداتك القابلة للتحقق." : "Retrouvez vos réussites et ouvrez vos certificats vérifiables."} />
    {rows.length ? <div className="learner-certificate-grid">{rows.map(({ certificate, course }) => <article key={certificate.id}><span className="learner-certificate-mark" aria-hidden="true"><Icon name="award" size={27} /></span><div><small>{ar ? "شهادة إتمام" : "Certificat de réussite"}</small><h2>{ar ? course.titleAr : course.titleFr}</h2><dl><div><dt>{ar ? "تاريخ الإصدار" : "Délivré le"}</dt><dd>{formatDate(certificate.issuedAt, locale)}</dd></div><div><dt>{ar ? "المعرّف" : "Identifiant"}</dt><dd dir="ltr">{certificate.code}</dd></div></dl></div><div className="learner-card-actions"><Link className="student-primary-action" href={`/${locale}/certificats/${certificate.code}`}>{ar ? "عرض" : "Voir"}</Link>{certificate.fileUrl ? <a className="student-secondary-action" href={`/api/account/certificates/${certificate.id}/download`}><Icon name="download" size={16} />{ar ? "تحميل" : "Télécharger"}</a> : null}</div></article>)}</div> : <LearnerEmptyState icon="award" title={ar ? "أكمل أول دورة للحصول على شهادة" : "Terminez votre première formation pour obtenir un certificat"} body={ar ? "تصدر الشهادات تلقائيًا بعد استيفاء شروط الدورة." : "Les certificats sont délivrés par le système lorsque les conditions de la formation sont remplies."} action={{ href: `/${locale}/dashboard/formations`, label: ar ? "عرض دوراتي" : "Voir mes formations" }} />}
  </div>;
}
