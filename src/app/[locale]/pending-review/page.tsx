import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/server/auth/session";
import { getUserPersonas } from "@/server/queries/personas";

export const dynamic = "force-dynamic";

const personaLabel: Record<string, { fr: string; ar: string }> = {
  TEACHER: { fr: "formateur", ar: "مكوّن" },
  AVS: { fr: "AVS", ar: "مرافق حياة مدرسية" },
  SPECIALIST: { fr: "spécialiste", ar: "أخصائي" },
  ORGANIZATION: { fr: "organisation", ar: "مؤسسة" },
};

const statusLabel: Record<string, { fr: string; ar: string }> = {
  PENDING_REVIEW: { fr: "en cours d’examen", ar: "قيد المراجعة" },
  SUSPENDED: { fr: "suspendu", ar: "موقوف" },
  REJECTED: { fr: "refusé", ar: "مرفوض" },
};

// No persona guard here (unlike portal pages): this page must remain
// reachable regardless of persona status to avoid a redirect loop between
// the portal layout and this page. Only login is required. No professional
// data is rendered — just the status.
export default async function PendingReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireUser(locale);
  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((row) => row.isPrimary);
  const persona = primary ? personaLabel[primary.persona] : undefined;
  const status = primary ? statusLabel[primary.status] : undefined;

  return <>
    <PageHero
      eyebrow={ar ? "حالة الحساب" : "Statut du compte"}
      title={ar ? "طلبك قيد المراجعة" : "Votre demande est en cours d’examen"}
      description={ar
        ? "يقوم فريق الأكاديمية بمراجعة ملفك المهني. ستتلقى إشعارًا بمجرد تفعيل مساحتك."
        : "L’équipe de l’Académie examine votre profil professionnel. Vous serez informé dès que votre espace sera activé."}
    />
    <section className="section"><div className="container">
      <div className="dashboard-panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="panel-head"><Icon name="clock" size={22}/><h2>{persona ? (ar ? `مساحة ${persona.ar}` : `Espace ${persona.fr}`) : (ar ? "المساحة المهنية" : "Espace professionnel")}</h2></div>
        <p>{status ? (ar ? `الحالة الحالية: ${status.ar}.` : `Statut actuel : ${status.fr}.`) : (ar ? "لا يوجد ملف مهني مرتبط بحسابك حاليًا." : "Aucun profil professionnel n’est actuellement associé à votre compte.")}</p>
        <p className="small-muted">{ar
          ? "لا داعي لإعادة التسجيل. سيتم إعلامك عبر البريد الإلكتروني عند اتخاذ قرار بشأن طلبك."
          : "Inutile de vous réinscrire : vous serez informé par email dès qu’une décision aura été prise concernant votre demande."}</p>
      </div>
    </div></section>
  </>;
}
