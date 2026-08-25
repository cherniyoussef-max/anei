import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { certificates, courses } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { formatDate, isLocale } from "@/lib/i18n";

export const dynamic="force-dynamic";
export default async function CertificatePage({params}:{params:Promise<{locale:string;code:string}>}){const {locale,code}=await params;if(!isLocale(locale))notFound();const session=await requireUser(locale);const [row]=await db.select({certificate:certificates,course:courses}).from(certificates).innerJoin(courses,eq(certificates.courseId,courses.id)).where(and(eq(certificates.code,code),eq(certificates.userId,session.user.id))).limit(1);if(!row)notFound();const ar=locale==="ar";return <section className="certificate-page"><div className="container"><div className="certificate-document"><div className="certificate-seal">ANEI</div><span className="eyebrow">{ar?"شهادة إتمام":"Certificat de réussite"}</span><h1>{ar?"الأكاديمية الوطنية للتربية الدامجة":"Académie Nationale de l’Éducation Inclusive"}</h1><p>{ar?"تشهد بأن":"certifie que"}</p><h2>{session.user.name}</h2><p>{ar?"أتم بنجاح المسار":"a terminé avec succès le parcours"}</p><h3>{ar?row.course.titleAr:row.course.titleFr}</h3><div className="certificate-meta"><span>{formatDate(row.certificate.issuedAt,locale)}</span><span>{row.certificate.code}</span></div><p className="small-muted">{ar?"يمكن طباعة هذه الصفحة أو حفظها بصيغة PDF من المتصفح.":"Cette page est optimisée pour l’impression et peut être enregistrée en PDF depuis le navigateur."}</p></div></div></section>}
