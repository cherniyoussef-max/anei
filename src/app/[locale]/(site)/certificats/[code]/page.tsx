import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { certificates, courses, user } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { formatDate, isLocale } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  if (!isLocale(locale)) notFound();

  const [row] = await db
    .select({ certificate: certificates, course: courses, recipient: user })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .innerJoin(user, eq(certificates.userId, user.id))
    .where(eq(certificates.code, code))
    .limit(1);

  if (!row) notFound();

  const session = await getSession();
  const isOwner = session?.user?.id === row.certificate.userId;
  const ar = locale === "ar";
  const altText = ar
    ? "الأكاديمية الوطنية للتربية الدامجة"
    : "Académie Nationale de l’Éducation Inclusive";

  return (
    <section className="certificate-page py-12 px-4 bg-[#F4F7FA]">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Verification Status Badge */}
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-none">
              <Icon name="check" size={20} />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                {ar ? "شهادة رسمية موثقة" : "Certificat Officiel Vérifié"}
              </div>
              <div className="text-sm font-semibold text-emerald-950 mt-0.5">
                {ar
                  ? "مسجلة بالسجل الوطني للكفاءات لدى ANEI"
                  : "Enregistré au registre national des compétences ANEI"}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200" dir="ltr">
            {row.certificate.code}
          </span>
        </div>

        {/* Certificate Card Document */}
        <div className="bg-white rounded-3xl border border-[#E3E8EF] p-8 sm:p-12 shadow-md text-center space-y-5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#1B3A5C] via-[#B8925A] to-[#1B3A5C]" />

          <div className="certificate-seal-container mb-4 flex justify-center">
            <Image
              src="/brand/anei-logo-4x-transparent.png"
              alt={altText}
              width={260}
              height={136}
              priority
              className="h-20 sm:h-24 w-auto object-contain mx-auto"
            />
          </div>

          <span className="text-xs font-bold uppercase tracking-widest text-[#B8925A]">
            {ar ? "شهادة إتمام وتأهيل مهني" : "Certificat de Réussite & Qualification"}
          </span>

          <h1 className="font-sans text-xl sm:text-2xl font-bold text-[#1B3A5C]">
            {ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive"}
          </h1>

          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            {ar ? "تشهد رسمياً بأن" : "atteste officiellement que"}
          </p>

          <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#1B3A5C] tracking-tight">
            {row.recipient.name}
          </h2>

          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {ar
              ? "قد أتم(ت) بنجاح جميع الوحدات والتقييمات المعتمدة للمسار التكويني المهني :"
              : "a validé avec succès l'ensemble des modules et évaluations pratiques du parcours certifiant :"}
          </p>

          <div className="p-4 rounded-2xl bg-[#F4F7FA] border border-[#E3E8EF] max-w-lg mx-auto">
            <h3 className="font-sans text-base sm:text-lg font-bold text-slate-900">
              {ar ? row.course.titleAr : row.course.titleFr}
            </h3>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">{ar ? "تاريخ الإصدار" : "Date de délivrance"}</span>
              <strong className="text-slate-800">{formatDate(row.certificate.issuedAt, locale)}</strong>
            </div>
            <div className="w-px h-8 bg-slate-200 hidden sm:block" />
            <div>
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">{ar ? "الرمز التعريفي" : "Identifiant unique"}</span>
              <strong className="font-mono text-[#B8925A]" dir="ltr">{row.certificate.code}</strong>
            </div>
          </div>

          {/* Action: Download PDF */}
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
            {isOwner && (
              <a
                href={`/api/account/certificates/${row.certificate.id}/download`}
                download
                className="btn btn-primary px-7 py-3 rounded-full font-bold text-xs shadow-md hover:shadow-lg inline-flex items-center gap-2"
              >
                <Icon name="arrow" size={15} className="rotate-90 text-amber-300" />
                <span>{ar ? "تحميل الشهادة الرسمية (PDF A4)" : "Télécharger mon certificat officiel (PDF A4)"}</span>
              </a>
            )}
            <Link
              href={`/${locale}/formations`}
              className="btn btn-secondary px-5 py-2.5 rounded-full font-bold text-xs inline-flex items-center gap-1.5"
            >
              <span>{ar ? "استكشاف المزيد من المسارات" : "Explorer les formations"}</span>
              <Icon name="arrow" size={13} className="directional-icon" />
            </Link>
          </div>
        </div>

        {/* Verification Guarantee Footer */}
        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          {ar
            ? "هذه الشهادة وثيقة رسمية مؤمنة بختم الأكاديمية الوطنية للتربية الدامجة بتونس. التحقق متاح دائماً عبر رمز الاستجابة أو الرابط الرسمي."
            : "Ce certificat est un titre professionnel officiel délivré par l'Académie Nationale de l'Éducation Inclusive. Toute vérification d'authenticité est garantie en ligne."}
        </p>
      </div>
    </section>
  );
}

