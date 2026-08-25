import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AssessmentPlayer } from "@/components/learning/AssessmentPlayer";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerAssessment } from "@/server/services/learning-assessments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AssessmentPage({ params }: { params: Promise<{ locale: string; slug: string; assessmentId: string }> }) {
  const { locale, slug, assessmentId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(assessmentId).success) notFound();
  const session = await requireUser(locale);
  const data = await getLearnerAssessment(session.user.id, assessmentId);
  if (!data) notFound();
  return <section className="course-assessment-room"><Link className="course-room-back" href={`/${locale}/apprendre/${slug}`}>{locale === "ar" ? "العودة إلى الدورة" : locale === "en" ? "Back to course" : "Retour à la formation"}</Link><AssessmentPlayer locale={locale} data={data}/></section>;
}
