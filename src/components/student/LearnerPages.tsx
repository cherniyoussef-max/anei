import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getCourseVisual } from "@/lib/visuals";

export function LearnerPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="learner-page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function LearnerEmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: { href: string; label: string } }) {
  return <div className="learner-page-empty"><span aria-hidden="true"><Icon name={icon} size={25} /></span><div><h2>{title}</h2><p>{body}</p></div>{action ? <Link className="student-secondary-action" href={action.href}>{action.label}<Icon className="student-directional-icon" name="arrow" size={16} /></Link> : null}</div>;
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
    <div className="learner-course-card-body"><div className="learner-object-meta"><span>{course.category}</span>{course.progress >= 100 ? <span className="learner-status-success"><Icon name="check" size={14} />{ar ? "مكتملة" : "Terminée"}</span> : null}</div><h2>{course.title}</h2><LearnerProgress value={course.progress} label={ar ? `تقدم الدورة ${course.progress}%` : `Progression de la formation : ${course.progress} %`} /><Link className="student-primary-action" href={`/${locale}/apprendre/${course.slug}`}><Icon name="play" size={17} />{course.progress >= 100 ? (ar ? "مراجعة الدورة" : "Revoir la formation") : (ar ? "متابعة التعلم" : "Continuer")}</Link></div>
  </article>)}</div>;
}
