import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/server/auth/session";
import { getUserPersonas } from "@/server/queries/personas";

export const dynamic = "force-dynamic";

const personaLabel: Record<string, { fr: string; ar: string }> = {
  TEACHER: { fr: "Formateur / Enseignant", ar: "مكوّن / مدرس" },
  AVS: { fr: "Accompagnant (AVS)", ar: "مرافق حياة مدرسية" },
  SPECIALIST: { fr: "Spécialiste de santé", ar: "أخصائي رعاية" },
  ORGANIZATION: { fr: "Établissement / Organisation", ar: "مؤسسة تعليمية" },
};

const PERSONA_FIGURINE: Record<string, string> = {
  TEACHER: "/media/persona-teacher.webp",
  AVS: "/media/persona-avs.webp",
  SPECIALIST: "/media/persona-specialist.webp",
  ORGANIZATION: "/media/persona-institution.webp",
};

const statusLabel: Record<string, { fr: string; ar: string }> = {
  PENDING_REVIEW: { fr: "Examen académique en cours", ar: "قيد الفحص والمراجعة الأكاديمية" },
  SUSPENDED: { fr: "Compte suspendu", ar: "حساب موقوف مؤقتًا" },
  REJECTED: { fr: "Dossier non validé", ar: "طلب غير مستوفٍ للشروط" },
};

export default async function PendingReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireUser(locale);
  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((row) => row.isPrimary);
  const persona = primary ? personaLabel[primary.persona] : undefined;
  const status = primary ? statusLabel[primary.status] : undefined;
  const figurine = primary && primary.persona in PERSONA_FIGURINE ? PERSONA_FIGURINE[primary.persona] : "/media/auth-guide-welcome.webp";

  return (
    <>
      <PageHero
        eyebrow={ar ? "التحقق المهني" : "Vérification professionnelle"}
        title={ar ? "ملفك المهني قيد المراجعة" : "Votre demande est en cours d’examen"}
        description={ar
          ? "يقوم الفريق الأكاديمي واللجنة العلمية لـ ANEI بالتحقق من بياناتك لضمان جودة وأمان الفضاء المهني."
          : "Le comité pédagogique d’ANEI vérifie actuellement vos informations pour garantir un cadre d’exercice certifié et sécurisé."}
      />

      <section className="section">
        <div className="container">
          <div className="pending-review-layout">
            <div className="pending-review-card">
              <div className="pending-review-head">
                <div className="pending-review-avatar">
                  <Image
                    src={figurine}
                    alt=""
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                </div>
                <div className="pending-review-title">
                  <span className="pending-status-badge">
                    <Icon name="clock" size={13} />
                    <span>{status ? (ar ? status.ar : status.fr) : (ar ? "قيد المراجعة" : "En cours d’examen")}</span>
                  </span>
                  <h2>{persona ? (ar ? `مساحة ${persona.ar}` : `Espace ${persona.fr}`) : (ar ? "المساحة المهنية" : "Espace professionnel")}</h2>
                </div>
              </div>

              <div className="pending-timeline">
                <div className="timeline-step is-done">
                  <span className="timeline-dot">✓</span>
                  <div className="timeline-content">
                    <strong>{ar ? "إنشاء الحساب والتحقق من الهوية" : "Création du compte & identité"}</strong>
                    <span>{ar ? "تم تأكيد بريدك الإلكتروني بنجاح" : "Adresse e-mail et accès confirmés"}</span>
                  </div>
                </div>

                <div className="timeline-step is-done">
                  <span className="timeline-dot">✓</span>
                  <div className="timeline-content">
                    <strong>{ar ? "تقديم الملف والمؤهلات" : "Dossier professionnel soumis"}</strong>
                    <span>{ar ? "تم استلام معلومات التخصص والمؤسسة" : "Informations d’exercice et pièces enregistrées"}</span>
                  </div>
                </div>

                <div className="timeline-step is-active">
                  <span className="timeline-dot">⏳</span>
                  <div className="timeline-content">
                    <strong>{ar ? "مراجعة الفريق الأكاديمي" : "Validation par le comité ANEI"}</strong>
                    <span>{ar ? "مدة المراجعة المعتادة: 24 إلى 48 ساعة عمل" : "Délai moyen d’instruction : 24 à 48 heures ouvrées"}</span>
                  </div>
                </div>

                <div className="timeline-step">
                  <span className="timeline-dot">4</span>
                  <div className="timeline-content">
                    <strong>{ar ? "تفعيل المساحة والأدوات" : "Activation des outils métier"}</strong>
                    <span>{ar ? "إشعار فوري عبر البريد الإلكتروني عند التفعيل" : "Notification par e-mail dès la décision prise"}</span>
                  </div>
                </div>
              </div>

              <p className="small-muted" style={{ margin: "20px 0 0", textAlign: "start" }}>
                {ar
                  ? "لا داعي لإعادة إرسال طلب جديد. سيتم إشعارك فور اكتمال المراجعة أو في حال الحاجة إلى وثيقة إضافية."
                  : "Inutile de soumettre une nouvelle demande. Vous recevrez une notification automatique dès validation ou si un complément est requis."}
              </p>
            </div>

            {/* What to do while waiting */}
            <div className="pending-waiting-card">
              <h3>{ar ? "ماذا يمكنك فعله أثناء الانتظار؟" : "Que pouvez-vous explorer dès maintenant ?"}</h3>
              <div className="pending-waiting-links">
                <Link href={`/${locale}/formations`} className="waiting-link-btn">
                  <Icon name="book" size={16} />
                  <span>{ar ? "استكشاف كتالوج الدورات" : "Catalogue des formations"}</span>
                </Link>
                <Link href={`/${locale}/webinaires`} className="waiting-link-btn">
                  <Icon name="video" size={16} />
                  <span>{ar ? "مواعيد الندوات القادمة" : "Webinaires & ateliers"}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
