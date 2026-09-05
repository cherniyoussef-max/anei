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
    <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#E7E0D3] bg-white p-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#FCFBF8] to-[#F0E4CC] text-[#082D55]" aria-hidden="true"><EmptyIcon size={28} strokeWidth={1.75} /></span>
      <div className="max-w-md">
        <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">{title}</h2>
        <p className="mt-1.5 text-sm text-[#7a7261]">{body}</p>
      </div>
      {action ? (
        <Link
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-[#082D55] bg-white px-5 py-2.5 text-sm font-semibold text-[#082D55] transition-all duration-200 ease-in-out hover:bg-[#082D55] hover:text-white"
          href={action.href}
        >
          {action.label}
          <ArrowRight size={16} strokeWidth={1.75} />
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
