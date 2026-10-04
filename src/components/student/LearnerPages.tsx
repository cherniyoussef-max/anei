import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, PlayCircle, type LucideIcon } from "lucide-react";
import type { Locale } from "@/types";
import { getCourseVisual } from "@/lib/visuals";

export function LearnerPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="learner-page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function LearnerEmptyState({ icon: EmptyIcon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-2xl border-2 border-dashed border-[#E2E8F0] bg-white p-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F0F6FF] text-[#0056D2]" aria-hidden="true"><EmptyIcon size={26} strokeWidth={1.75} /></span>
      <div className="max-w-md">
        <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
        <p className="mt-1 text-xs text-[#64748B] leading-relaxed">{body}</p>
      </div>
      {action ? (
        <Link
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#0056D2] transition hover:bg-[#F0F6FF]"
          href={action.href}
        >
          {action.label}
          <ArrowRight size={15} strokeWidth={1.75} className="rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  );
}

export function LearnerProgress({ value, label }: { value: number; label: string }) {
  const safe = Math.min(100, Math.max(0, value));
  return <div className="learner-progress"><progress max={100} value={safe} aria-label={label}>{safe}%</progress><span dir="ltr">{safe}%</span></div>;
}

export type LearnerCourse = { id: string; slug: string; title: string; category: string; progress: number; status: string };

export function LearnerCourseList({ locale, courses }: { locale: Locale; courses: LearnerCourse[] }) {
  const ar = locale === "ar";
  return <div className="learner-course-grid">{courses.map((course) => <article className="learner-course-card" key={course.id}>
    <Image src={getCourseVisual(course.slug)} alt="" width={360} height={220} sizes="(max-width: 767px) 100vw, 320px" />
    <div className="learner-course-card-body"><div className="learner-object-meta"><span>{course.category}</span>{course.progress >= 100 ? <span className="learner-status-success"><Check size={14} strokeWidth={1.75} />{ar ? "مكتملة" : "Terminée"}</span> : null}</div><h2>{course.title}</h2><LearnerProgress value={course.progress} label={ar ? `تقدم الدورة ${course.progress}%` : `Progression de la formation : ${course.progress} %`} /><Link className="student-primary-action" href={`/${locale}/apprendre/${course.slug}`}><PlayCircle size={17} strokeWidth={1.75} />{course.progress >= 100 ? (ar ? "مراجعة الدورة" : "Revoir la formation") : (ar ? "متابعة التعلم" : "Continuer")}</Link></div>
  </article>)}</div>;
}
