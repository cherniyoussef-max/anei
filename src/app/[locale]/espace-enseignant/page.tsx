import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { auth } from "@/server/auth";
import {
  getOrCreateTeacherClassroom,
  getShowcaseTeacherClassroom,
} from "@/server/services/inclusive-ecosystem";
import { TeacherClassroomWorkspace } from "@/components/inclusive/TeacherClassroomWorkspace";
import type { DifficultyKey, AdaptationKey } from "@/lib/inclusive-taxonomy";
import { Sparkles, ArrowRight, LogIn } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "فضاء الأستاذ - قسمي الدامج | ANEI" : "Espace Enseignant - Ma classe inclusive | ANEI",
    description: ar
      ? "تكييف الامتحانات والمواد الدراسية ومتابعة صعوبات التعلم وإنشاء وثائق OpenXML مكيفة."
      : "Gestion pédagogique inclusive, adaptation d'évaluations et génération de documents accessibles.",
  };
}

export default async function EspaceEnseignantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const isAuthenticated = Boolean(session?.user);

  const { classroom, students, tips } = isAuthenticated && session?.user?.id
    ? await getOrCreateTeacherClassroom(session.user.id)
    : await getShowcaseTeacherClassroom();

  const formattedStudents = students.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    difficulties: (s.difficulties as DifficultyKey[]) || [],
    adaptations: (s.adaptations as AdaptationKey[]) || [],
    personalNote: s.personalNote || "",
    downloadStatus: s.downloadStatus || "A_TELECHARGER",
  }));

  const formattedTips = tips.map((t) => ({
    id: t.id,
    authorName: t.authorName,
    difficultyKey: t.difficultyKey,
    situationTitle: t.situationTitle,
    whatToDo: t.whatToDo,
    whatToAvoid: t.whatToAvoid || "",
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Banner for visitor / demo mode */}
      {!isAuthenticated && (
        <div className="bg-[#0A192F] text-white border-b border-slate-700/60 px-4 py-2.5 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-center sm:text-start">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold text-[11px]">
                <Sparkles className="w-3 h-3 stroke-[2]" />
                {ar ? "وضع العرض والاستكشاف" : "Aperçu & Démonstration"}
              </span>
              <span className="text-slate-300">
                {ar
                  ? "أنت في فضاء المعاينة التفاعلي. سجّل الدخول لحفظ تلاميذك وتكييفاتك بشكل دائم."
                  : "Explorez librement l'espace enseignant. Connectez-vous pour enregistrer votre classe et synchroniser vos aménagements."}
              </span>
            </div>
            <Link
              href={`/${locale}/connexion?callbackUrl=/${locale}/dashboard/classe-inclusive`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0056D2] hover:bg-[#00419e] text-white font-medium transition-colors shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{ar ? "تسجيل الدخول للربط الكامل" : "Se connecter pour synchroniser"}</span>
              <ArrowRight className="w-3 h-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <TeacherClassroomWorkspace
          locale={locale}
          initialClassroom={{
            id: classroom.id,
            className: classroom.className,
            palettePreset: classroom.palettePreset,
            customColorsJson: classroom.customColorsJson,
          }}
          initialStudents={formattedStudents}
          initialTips={formattedTips}
        />
      </div>
    </div>
  );
}
