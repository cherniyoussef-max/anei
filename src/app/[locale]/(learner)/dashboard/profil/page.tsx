import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getUserPersonas } from "@/server/queries/personas";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";
import { LearnerProfileForm } from "@/components/student/LearnerProfileForm";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);

  if (["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role))) {
    redirect(`/${locale}/admin`);
  }

  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((row) => row.isPrimary);
  if (primary && primary.persona !== "STUDENT") {
    if (primary.status === "ACTIVE") {
      redirect(`/${locale}${personaPortalPath[primary.persona as Persona]}/profil`);
    }
    redirect(`/${locale}/pending-review`);
  }

  const ar = locale === "ar";
  const [credential, profile] = await Promise.all([
    db.query.account.findFirst({
      where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")),
    }),
    getUserProfile(session.user.id),
  ]);

  const initials = (session.user.name ?? "A")
    .trim()
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page Title & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          <span>{ar ? "فضاء التعلم" : "Espace Apprenant"}</span>
          <span className="text-slate-300">•</span>
          <span className="text-[#082D55]">{ar ? "الملف الشخصي" : "Profil & Sécurité"}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {ar ? "الملف الشخصي وإعدادات الأمان" : "Profil & Paramètres de Sécurité"}
        </h1>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          {ar
            ? "حدّث بياناتك الشخصية والتعليمية، وتابع وسائل الاتصال المعتمدة وأمان حسابك."
            : "Gérez vos informations d'apprentissage, vos coordonnées certifiées et la sécurité de votre compte."}
        </p>
      </div>

      {/* Identity Summary Card (Stripe/Vercel style) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#082D55] text-amber-300 font-bold text-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200/40">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {session.user.name || "Apprenant"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#082D55] border border-blue-200">
                {ar ? "حساب متعلم ANEI" : "Apprenant ANEI"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono" dir="ltr">
              {session.user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold self-stretch sm:self-auto justify-center">
          <Icon name="check" size={15} className="text-emerald-700" />
          <span>{ar ? "جلسة مصادق عليها" : "Session active sécurisée"}</span>
        </div>
      </div>

      {/* Personal Info Form */}
      {profile && (
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">
              {ar ? "المعلومات الشخصية والمسار التعليمي" : "Informations Personnelles & Parcours"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "هذه البيانات تظهر على شهاداتك الرسمية وسجل تكوينك الوطني."
                : "Ces informations figurent sur vos attestations officielles et votre dossier de formation."}
            </p>
          </div>

          <LearnerProfileForm
            locale={locale}
            values={{
              firstName: profile.firstName,
              lastName: profile.lastName,
              country: profile.country ?? "Tunisie",
              governorate: profile.governorate ?? "Tunis",
              city: profile.city ?? "",
              preferredLocale: profile.preferredLocale,
              educationLevel: profile.educationLevel ?? "",
              institutionName: profile.institutionName ?? "",
            }}
          />
        </section>
      )}

      {/* Account Security & Devices */}
      <AccountSecurityPanel
        locale={locale}
        name={session.user.name}
        email={session.user.email}
        phoneNumber={profile?.phoneNumber}
        phoneVerifiedAt={profile?.phoneVerifiedAt}
        hasCredential={Boolean(credential)}
        showIdentityAndContact={false}
      />
    </div>
  );
}
