import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { auth } from "@/server/auth";
import { getOrCreateTeacherClassroom } from "@/server/services/inclusive-ecosystem";
import { TeacherClassroomWorkspace } from "@/components/inclusive/TeacherClassroomWorkspace";
import type { DifficultyKey, AdaptationKey } from "@/lib/inclusive-taxonomy";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "قسمي الدامج - فضاء الأستاذ | ANEI" : "Ma classe inclusive - Espace enseignant | ANEI",
    description: ar
      ? "تكييف الامتحانات والمواد الدراسية ومتابعة صعوبات التعلم وإنشاء وثائق OpenXML مكيفة."
      : "Gestion pédagogique inclusive, adaptation d'évaluations et génération de documents accessibles.",
  };
}

export default async function TeacherClassroomPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    redirect(`/${locale}/connexion?callbackUrl=/${locale}/dashboard/classe-inclusive`);
  }

  const { classroom, students, tips, evaluation } = await getOrCreateTeacherClassroom(session.user.id);

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

  const formattedEvaluation = evaluation
    ? {
        id: evaluation.id,
        title: evaluation.title,
        durationMinutes: evaluation.durationMinutes,
        questions: (evaluation.questionsJson as Array<{ full: string; simple: string; icon: string }>) || [],
      }
    : null;

  return (
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
        initialEvaluation={formattedEvaluation}
      />
    </div>
  );
}
