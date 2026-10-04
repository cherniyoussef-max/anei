"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  Award,
  PlayCircle,
  Clock,
  CalendarDays,
  BookOpen,
  Download,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  UserCheck,
  ExternalLink,
  ShieldCheck,
  Check,
  HelpCircle,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/types";
import { getCourseVisual } from "@/lib/visuals";

export type StudentCourseItem = {
  id: string;
  slug: string;
  title: string;
  progress: number;
  category?: string;
  coverImage?: string | null;
  status?: string;
};

export type ContinueLearningItem = StudentCourseItem & {
  moduleTitle?: string;
  lessonTitle?: string;
  remainingMinutes?: number;
  completedLessonsCount?: number;
  totalLessonsCount?: number;
};

export type StudentSessionItem = {
  id: string;
  title: string;
  date: string;
  startAtRaw?: string;
  trainer: string;
  meetingUrl?: string;
  type?: "appointment" | "webinar";
};

export type StudentResourceItem = {
  id: string;
  title: string;
  date: string;
  type?: string;
  description?: string;
};

export type StudentCertificateItem = {
  id: string;
  title: string;
  code: string;
  date?: string;
};

function ProgressRing({ value, size = 50, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) {
  const safeValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center flex-none" style={{ width: size, height: size }} aria-hidden="true">
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#0056D2"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-[#1F1F1F] font-mono tracking-tighter" dir="ltr">
        {safeValue}%
      </span>
    </div>
  );
}

function formatCategory(category?: string, ar?: boolean) {
  if (!category) return ar ? "التربية الدامجة" : "Pédagogie inclusive";
  const cat = category.toLowerCase();
  if (cat.includes("autis")) return ar ? "طيف التوحد" : "Troubles du spectre de l’autisme";
  if (cat.includes("dys")) return ar ? "صعوبات التعلّم DYS" : "Troubles des apprentissages";
  if (cat.includes("avs")) return ar ? "مرافقة مدرسية AVS" : "Accompagnement AVS";
  if (cat.includes("inclus")) return ar ? "التربية الدامجة" : "Éducation inclusive";
  return ar ? "تكوين مهني معتمد" : "Formation certifiante";
}

function parseSessionDate(dateStr: string, rawIso?: string, locale: Locale = "fr") {
  const date = rawIso ? new Date(rawIso) : null;
  if (date && !isNaN(date.getTime())) {
    const month = date.toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", { month: "short" }).toUpperCase();
    const day = date.toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", { day: "numeric" });
    return { month, day };
  }
  const parts = dateStr.split(/[\s,.-]+/);
  const day = parts.find((p) => /^\d{1,2}$/.test(p)) || "01";
  const month = parts.find((p) => p.length >= 3 && !/^\d+$/.test(p)) || (locale === "ar" ? "أكتوبر" : "OCT");
  return { month: month.slice(0, 4).toUpperCase(), day };
}

function EmptyState({
  icon: StateIcon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="student-empty-state-box">
      <span className="student-empty-state-icon" aria-hidden="true">
        <StateIcon size={24} strokeWidth={1.75} />
      </span>
      <div className="student-empty-state-text">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {action ? (
        <Link href={action.href} className="student-empty-state-action">
          <span>{action.label}</span>
          <ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}

export function StudentDashboard({
  locale,
  userName,
  continueItem,
  averageProgress,
  courses,
  sessions,
  resources,
  certificates,
  completedLessonsTotal = 0,
}: {
  locale: Locale;
  userName: string;
  completedLessonsTotal?: number;
  continueItem?: ContinueLearningItem;
  averageProgress: number;
  courses: StudentCourseItem[];
  sessions: StudentSessionItem[];
  resources: StudentResourceItem[];
  certificates: StudentCertificateItem[];
  pointsBalance?: number;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  const inProgressCourses = courses.filter((c) => c.progress < 100);
  const completedCourses = courses.filter((c) => c.progress >= 100);

  const [activeTab, setActiveTab] = useState<"in_progress" | "completed" | "certificates">("in_progress");

  // Weekly study goal tracker (Mon - Sun)
  const weekDays = [
    { id: "mon", label: ar ? "إث" : "L", num: "1", completed: true, isToday: false },
    { id: "tue", label: ar ? "ثل" : "M", num: "2", completed: true, isToday: false },
    { id: "wed", label: ar ? "أر" : "M", num: "3", completed: true, isToday: true },
    { id: "thu", label: ar ? "خم" : "J", num: "4", completed: false, isToday: false },
    { id: "fri", label: ar ? "جم" : "V", num: "5", completed: false, isToday: false },
    { id: "sat", label: ar ? "سب" : "S", num: "6", completed: false, isToday: false },
    { id: "sun", label: ar ? "أح" : "D", num: "7", completed: false, isToday: false },
  ];

  // Secondary courses list (if continueItem is featured in Hero, other courses in the tab)
  const displayedCourses = activeTab === "completed" 
    ? completedCourses 
    : inProgressCourses;

  const otherCourses = continueItem && activeTab === "in_progress"
    ? displayedCourses.filter((c) => c.slug !== continueItem.slug)
    : displayedCourses;

  return (
    <div className="student-dashboard-home">
      {/* 1. COURSERA EDITORIAL GREETING & WEEKLY LEARNING GOAL */}
      <header className="student-welcome-header">
        <div className="student-welcome-info">
          <p className="student-welcome-kicker">
            {ar ? "أكاديمية ANEI · مساحة المتعلم" : en ? "ANEI Academy · Learner Space" : "Académie ANEI · Espace Apprenant"}
          </p>
          <h1 className="student-welcome-title">
            {ar ? `مرحبًا، ${firstName}` : `Bonjour, ${firstName}`}
          </h1>
          <p className="student-welcome-subtitle">
            {ar
              ? "تابع تقدمك الدراسي واستكمل وحداتك التدريبية للحصول على شهادتك الرسمية."
              : en
              ? "Track your momentum and pick up right where you left off."
              : "Suivez votre rythme d’apprentissage et reprenez exactement là où vous vous êtes arrêté."}
          </p>
        </div>

        {/* Coursera Weekly Goal / Habit Tracker */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#F0F6FF] text-[#0056D2] border border-[#BFDBFE] flex items-center justify-center flex-none">
              <Flame size={20} className="text-[#0056D2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-sm font-bold text-[#0F172A]">
                  {ar ? "الهدف الأسبوعي : 3 من 5 أيام" : en ? "Weekly goal: 3 of 5 days" : "Objectif de la semaine : 3 jours sur 5 complétés"}
                </strong>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  🔥 {ar ? "يومان متتاليان" : en ? "2-day streak" : "Série active : 2 jours"}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {ar
                  ? "خصص 20 دقيقة يوميًا للحفاظ على وتيرة التعلّم واستكمال مسارك."
                  : en
                  ? "Dedicate 20 minutes a day to stay on track for certification."
                  : "Consacrez 20 minutes par jour pour maintenir votre rythme de certification."}
              </p>
            </div>
          </div>

          {/* 7 Days Tracker */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-[#F1F5F9]">
            {weekDays.map((d) => (
              <div key={d.id} className="flex flex-col items-center gap-1 flex-1 md:flex-none">
                <span className="text-[10px] font-semibold text-[#64748B]">{d.label}</span>
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    d.completed
                      ? "bg-[#0056D2] text-white shadow-xs"
                      : d.isToday
                      ? "border-2 border-[#0056D2] text-[#0056D2] bg-[#F0F6FF]"
                      : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}
                  title={`${d.label} - ${d.completed ? "Complété" : d.isToday ? "Aujourd'hui" : "À venir"}`}
                >
                  {d.completed ? <Check size={13} strokeWidth={3} /> : d.num}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* 2. COURSERA HERO "CONTINUE LEARNING" COCKPIT */}
      <section className="student-hero-section" aria-labelledby="continue-hero-title">
        {continueItem ? (
          <article className="student-hero-cockpit">
            <div className="student-hero-copy">
              <div className="student-hero-eyebrow">
                <span className="student-active-tag">
                  <span className="student-pulse-dot" aria-hidden="true" />
                  {ar ? "دورة قيد المتابعة" : en ? "Active Course" : "Formation en cours"}
                </span>
                <span className="student-category-pill">
                  ANEI • {formatCategory(continueItem.category, ar)}
                </span>
              </div>

              <h2 id="continue-hero-title" className="student-hero-heading">
                {continueItem.title}
              </h2>

              {/* Context Module / Lesson Stepper */}
              <div className="student-hero-context">
                <div className="student-context-row">
                  <BookOpen size={16} className="text-[#0056D2] flex-none" />
                  <span className="truncate">
                    {continueItem.moduleTitle || (ar ? "الوحدة الدراسية الجارية" : "Module en cours")}
                  </span>
                </div>
                <div className="student-context-lesson-row">
                  <span className="student-lesson-play-icon" aria-hidden="true">▶</span>
                  <strong className="truncate">
                    {continueItem.lessonTitle || (ar ? "متابعة الدرس القادم" : "Reprendre la prochaine leçon")}
                  </strong>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="student-hero-progress-block">
                <div className="student-hero-progress-header">
                  <span>{ar ? "التقدم في المنهاج" : en ? "Course Progress" : "Progression"}</span>
                  <span dir="ltr" className="student-hero-progress-percent">
                    {continueItem.progress}%
                  </span>
                </div>
                <div className="student-hero-progress-track">
                  <div
                    className="student-hero-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, continueItem.progress))}%` }}
                  />
                </div>
                <div className="student-hero-progress-meta">
                  <span>
                    {continueItem.totalLessonsCount
                      ? ar
                        ? `${continueItem.completedLessonsCount ?? 0} من أصل ${continueItem.totalLessonsCount} درسًا مكتملة`
                        : `${continueItem.completedLessonsCount ?? 0} sur ${continueItem.totalLessonsCount} leçons complétées`
                      : ar
                      ? "تابع المسار من آخر نقطة توقفت عندها"
                      : "Reprenez le parcours à votre rythme"}
                  </span>
                  {continueItem.remainingMinutes ? (
                    <span className="student-hero-time-pill">
                      <Clock size={13} />
                      {ar ? `~${continueItem.remainingMinutes} دقيقة متبقية` : `~${continueItem.remainingMinutes} min restantes`}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="student-hero-actions">
                <Link
                  className="student-hero-btn-primary"
                  href={`/${locale}/apprendre/${continueItem.slug}`}
                >
                  <PlayCircle size={18} />
                  <span>{ar ? "متابعة الدرس" : en ? "Resume Lesson" : "Reprendre la leçon"}</span>
                  <ArrowRight size={15} className="student-directional-icon" />
                </Link>
                <Link
                  className="student-hero-btn-secondary"
                  href={`/${locale}/apprendre/${continueItem.slug}#lessons`}
                >
                  <span>{ar ? "منهاج الدورة" : en ? "Syllabus" : "Plan de cours"}</span>
                </Link>
              </div>
            </div>

            {/* Media side */}
            <div className="student-hero-media">
              <Image
                src={getCourseVisual(continueItem.slug)}
                alt=""
                width={800}
                height={540}
                priority
                loading="eager"
                sizes="(max-width: 767px) 100vw, (max-width: 1100px) 40vw, 480px"
                className="student-hero-img"
              />
              <div className="student-hero-media-badge">
                <ShieldCheck size={16} className="text-[#0056D2]" />
                <span>{ar ? "شهادة رسمية معتمدة" : "Certification ANEI"}</span>
              </div>
            </div>
          </article>
        ) : (
          <article className="student-hero-cockpit is-empty-hero">
            <div className="student-empty-hero-copy">
              <div className="student-hero-eyebrow">
                <span className="student-active-tag">
                  <Sparkles size={14} className="text-[#0056D2]" />
                  {ar ? "ابدأ مسارك التعليمي" : "Démarrez votre parcours"}
                </span>
              </div>
              <h2 id="continue-hero-title" className="student-hero-heading">
                {ar ? "اكتشف الدورات التدريبية المعتمدة في التربية الدامجة" : "Découvrez les formations certifiantes en éducation inclusive"}
              </h2>
              <p className="student-empty-hero-desc">
                {ar
                  ? "طوّر مهاراتك مع برامج تدريبية متخصصة ومصممة لمرافقة التلاميذ ذوي الاحتياجات الخاصة وتمكين كل طفل من النجاح المدرسي."
                  : "Développez vos compétences avec des programmes spécialisés, conçus par des praticiens et experts pour accompagner efficacement chaque élève."}
              </p>
              <div className="student-hero-actions">
                <Link className="student-hero-btn-primary" href={`/${locale}/formations`}>
                  <span>{ar ? "استكشف كل الدورات" : "Explorer le catalogue"}</span>
                  <ArrowRight size={17} className="student-directional-icon" />
                </Link>
              </div>
            </div>
            <div className="student-hero-media">
              <Image
                src="/images/heroes/hero-documentary.webp"
                alt=""
                width={800}
                height={540}
                priority
                className="student-hero-img"
              />
            </div>
          </article>
        )}
      </section>

      {/* 3. COURSERA KPI METRICS ROW */}
      <section className="student-metrics-section" aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="sr-only">
          {ar ? "مؤشرات التقدم والنشاط" : "Indicateurs de progression"}
        </h2>
        <div className="student-metrics-grid">
          {/* Metric 1: Progression globale */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "التقدم الإجمالي" : "Progression générale"}</span>
              <ProgressRing value={averageProgress} size={42} strokeWidth={4} />
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{averageProgress}%</span>
              <p className="student-metric-caption">
                {courses.length > 0
                  ? ar
                    ? `متوسط الإنجاز على ${courses.length} مسار`
                    : `Moyenne sur ${courses.length} formation(s)`
                  : ar
                  ? "لا توجد دورات نشطة"
                  : "Aucune formation active"}
              </p>
            </div>
          </div>

          {/* Metric 2: Formations actives */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "الدورات النشطة" : "Formations actives"}</span>
              <span className="student-metric-icon-wrap is-navy" aria-hidden="true">
                <BookOpen size={18} strokeWidth={1.8} />
              </span>
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{inProgressCourses.length}</span>
              <p className="student-metric-caption">
                {ar
                  ? `${completedCourses.length} مكتملة · ${inProgressCourses.length} قيد المتابعة`
                  : `${completedCourses.length} terminée(s) · ${inProgressCourses.length} en cours`}
              </p>
            </div>
          </div>

          {/* Metric 3: Leçons validées */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "الدروس المنجزة" : "Leçons validées"}</span>
              <span className="student-metric-icon-wrap is-gold" aria-hidden="true">
                <CheckCircle2 size={18} strokeWidth={1.8} />
              </span>
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{completedLessonsTotal}</span>
              <Link href={`/${locale}/dashboard/formations`} className="student-metric-action-link">
                <span>{ar ? "متابعة المنهاج" : "Voir mes cours"}</span>
                <ChevronRight size={13} className="student-directional-icon" />
              </Link>
            </div>
          </div>

          {/* Metric 4: Certifications */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "الشهادات المحصلة" : "Certifications obtenues"}</span>
              <span className="student-metric-icon-wrap is-emerald" aria-hidden="true">
                <Award size={18} strokeWidth={1.8} />
              </span>
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{certificates.length}</span>
              <Link href={`/${locale}/dashboard/certificats`} className="student-metric-action-link">
                <span>{ar ? "شهادات قابلة للتحقق" : "Consulter mes certificats"}</span>
                <ChevronRight size={13} className="student-directional-icon" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COURSERA TABS & COURSES SECTION */}
      <div className="student-core-grid">
        {/* Left Column (Courses with Coursera Tabs) */}
        <section className="student-courses-panel" id="courses" aria-labelledby="courses-heading">
          {/* Coursera Interactive Tabs */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] gap-3 mb-5">
            <div className="flex items-center gap-1 sm:gap-2 -mb-px overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("in_progress")}
                className={`flex items-center gap-2 pb-3 pt-1 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "in_progress"
                    ? "border-[#0056D2] text-[#0056D2]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]"
                }`}
              >
                <span>{ar ? "قيد المتابعة" : en ? "In Progress" : "En cours"}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-bold transition-colors ${activeTab === "in_progress" ? "bg-[#0056D2] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                  {inProgressCourses.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("completed")}
                className={`flex items-center gap-2 pb-3 pt-1 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "completed"
                    ? "border-[#0056D2] text-[#0056D2]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]"
                }`}
              >
                <span>{ar ? "المكتملة" : en ? "Completed" : "Terminées"}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-bold transition-colors ${activeTab === "completed" ? "bg-[#0056D2] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                  {completedCourses.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("certificates")}
                className={`flex items-center gap-2 pb-3 pt-1 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "certificates"
                    ? "border-[#0056D2] text-[#0056D2]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]"
                }`}
              >
                <span>{ar ? "الشهادات" : en ? "Certificates" : "Certificats"}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-bold transition-colors ${activeTab === "certificates" ? "bg-[#0056D2] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                  {certificates.length}
                </span>
              </button>
            </div>

            <Link href={`/${locale}/dashboard/formations`} className="text-xs font-bold text-[#0056D2] hover:underline flex items-center gap-1.5 whitespace-nowrap flex-none pb-2">
              <span>{ar ? "عرض الكل" : "Voir tout"}</span>
              <ArrowRight size={13} className="student-directional-icon" />
            </Link>
          </div>

          {/* Tab Content 1: In Progress */}
          {activeTab === "in_progress" && (
            <div>
              {otherCourses.length > 0 ? (
                <div className="student-courses-stack">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    {ar ? "دورات أخرى مسجلة" : "Autres formations inscrites"}
                  </h3>
                  {otherCourses.map((course) => (
                    <article key={course.id} className="student-course-item">
                      <div className="student-course-item-thumb">
                        <Image
                          src={getCourseVisual(course.slug)}
                          alt=""
                          width={128}
                          height={88}
                          className="student-course-item-img"
                        />
                      </div>

                      <div className="student-course-item-content">
                        <div className="student-course-item-category">
                          ANEI • {formatCategory(course.category, ar)}
                        </div>
                        <h3 className="student-course-item-title">
                          {course.title}
                        </h3>
                        <div className="student-course-item-progress-row">
                          <div className="student-course-item-track">
                            <div
                              className="student-course-item-fill"
                              style={{ width: `${Math.min(100, Math.max(0, course.progress))}%`, background: "#0056D2" }}
                            />
                          </div>
                          <span className="student-course-item-percent" dir="ltr">
                            {course.progress}%
                          </span>
                        </div>
                      </div>

                      <div className="student-course-item-action">
                        <Link
                          href={`/${locale}/apprendre/${course.slug}`}
                          className="student-btn-primary-sm"
                          aria-label={`${ar ? "متابعة" : "Continuer"}: ${course.title}`}
                        >
                          <span>{course.progress > 0 ? (ar ? "متابعة" : "Continuer") : (ar ? "بدء الدورة" : "Commencer")}</span>
                          <ArrowRight size={14} className="student-directional-icon" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : continueItem ? (
                <div className="space-y-3">
                  <article className="student-course-item">
                    <div className="student-course-item-thumb">
                      <Image
                        src={getCourseVisual(continueItem.slug)}
                        alt=""
                        width={128}
                        height={88}
                        className="student-course-item-img"
                      />
                    </div>
                    <div className="student-course-item-content">
                      <div className="student-course-item-category">
                        ANEI • {formatCategory(continueItem.category, ar)}
                      </div>
                      <h3 className="student-course-item-title">
                        {continueItem.title}
                      </h3>
                      <div className="student-course-item-progress-row">
                        <div className="student-course-item-track">
                          <div
                            className="student-course-item-fill"
                            style={{ width: `${Math.min(100, Math.max(0, continueItem.progress))}%`, background: "#0056D2" }}
                          />
                        </div>
                        <span className="student-course-item-percent" dir="ltr">
                          {continueItem.progress}%
                        </span>
                      </div>
                    </div>
                    <div className="student-course-item-action">
                      <Link
                        href={`/${locale}/apprendre/${continueItem.slug}`}
                        className="student-btn-primary-sm"
                        aria-label={`${ar ? "متابعة" : "Continuer"}: ${continueItem.title}`}
                      >
                        <span>{ar ? "متابعة" : "Continuer"}</span>
                        <ArrowRight size={14} className="student-directional-icon" />
                      </Link>
                    </div>
                  </article>

                  {/* Coursera-style Recommended Next Specialization Card */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#F0F6FF] text-[#0056D2] border border-[#BFDBFE] flex items-center justify-center flex-none mt-0.5">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0056D2] bg-[#EBF3FF] px-2 py-0.5 rounded">
                            {ar ? "مسار موصى به" : "Spécialisation recommandée"}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#0F172A] mt-1">
                          {ar ? "طيف التوحّد والقسم الدامج (TSA)" : "TSA et classe inclusive : stratégies concrètes"}
                        </h4>
                        <p className="text-[11px] text-[#64748B] mt-0.5 max-w-sm">
                          {ar
                            ? "استراتيجيات عملية لتنظيم القسم ودعم التواصل والوقاية من السلوكيات المعقدة."
                            : "4 modules · Approche pratique en classe ordinaire · Certificat officiel ANEI"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/${locale}/formations/tsa-classe-inclusive`}
                      className="text-xs font-bold text-[#0056D2] hover:text-[#00419E] bg-white border border-[#CBD5E1] hover:border-[#0056D2] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap self-end sm:self-auto"
                    >
                      <span>{ar ? "استكشاف" : "Explorer"}</span>
                      <ArrowRight size={12} className="inline ms-1 student-directional-icon" />
                    </Link>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={GraduationCap}
                  title={ar ? "لا توجد دورات مسجلة بعد" : "Aucune formation pour le moment"}
                  body={ar ? "استكشف كتالوج ANEI واختر الدورة المناسبة لأهدافك المهنية." : "Explorez le catalogue ANEI pour démarrer votre premier parcours certifiant."}
                  action={{
                    href: `/${locale}/formations`,
                    label: ar ? "تصفح الدورات" : "Parcourir le catalogue",
                  }}
                />
              )}
            </div>
          )}

          {/* Tab Content 2: Completed */}
          {activeTab === "completed" && (
            <div>
              {completedCourses.length > 0 ? (
                <div className="student-courses-stack">
                  {completedCourses.map((course) => (
                    <article key={course.id} className="student-course-item">
                      <div className="student-course-item-thumb">
                        <Image
                          src={getCourseVisual(course.slug)}
                          alt=""
                          width={128}
                          height={88}
                          className="student-course-item-img"
                        />
                        <span className="student-course-item-check" title={ar ? "مكتملة" : "Terminée"}>
                          <Check size={13} strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="student-course-item-content">
                        <div className="student-course-item-category">
                          ANEI • {formatCategory(course.category, ar)}
                        </div>
                        <h3 className="student-course-item-title">{course.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mt-1">
                          <CheckCircle2 size={14} />
                          <span>{ar ? "مكتملة بنجاح بنسبة 100%" : "Formation validée à 100%"}</span>
                        </div>
                      </div>
                      <div className="student-course-item-action">
                        <Link
                          href={`/${locale}/apprendre/${course.slug}`}
                          className="student-btn-ghost-sm"
                        >
                          <span>{ar ? "مراجعة" : "Revoir"}</span>
                          <ArrowRight size={14} className="student-directional-icon" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-center flex flex-col items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 text-[#0056D2] grid place-items-center">
                    <Award size={22} />
                  </div>
                  <div>
                    <strong className="text-sm text-[#0F172A] block">{ar ? "لم تكمل أي دورة بعد" : "Aucune formation terminée pour le moment"}</strong>
                    <p className="text-xs text-[#64748B] mt-1 max-w-md">
                      {ar ? "واصل تقدمك في دورتك الحالية لإكمال جميع الوحدات والحصول على شهادتك الرسمية." : "Poursuivez vos leçons actives pour valider 100% du parcours et débloquer votre attestation."}
                    </p>
                  </div>
                  {continueItem ? (
                    <Link href={`/${locale}/apprendre/${continueItem.slug}`} className="student-btn-primary-sm mt-1">
                      <span>{ar ? "مواصلة الدورة الحالية" : "Continuer mon cours en cours"}</span>
                      <ArrowRight size={14} className="student-directional-icon" />
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Tab Content 3: Certificates */}
          {activeTab === "certificates" && (
            <div>
              {certificates.length > 0 ? (
                <div className="student-certificates-stack">
                  {certificates.map((cert) => (
                    <Link
                      key={cert.id}
                      href={`/${locale}/certificats/${cert.code}`}
                      className="student-certificate-item"
                    >
                      <div className="student-certificate-seal" aria-hidden="true">
                        <Award size={22} strokeWidth={1.8} />
                      </div>
                      <div className="student-certificate-info">
                        <h3 className="student-certificate-title">{cert.title}</h3>
                        <span className="student-certificate-code" dir="ltr">
                          Réf: {cert.code}
                        </span>
                      </div>
                      <ChevronRight size={18} className="student-directional-icon text-[#7A7261]" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="student-cert-milestone-card">
                  <div className="student-cert-milestone-seal">
                    <Award size={30} strokeWidth={1.75} className="text-[#0056D2]" />
                  </div>
                  <div className="student-cert-milestone-body">
                    <h3>{ar ? "مسار الحصول على الشهادة الرسمية" : "Parcours de certification officielle"}</h3>
                    <p>
                      {ar
                        ? "أكمل دراسة دورتك التدريبية بنسبة 100% للحصول على شهادة معتمدة وموثقة برمز QR رسمي."
                        : "Complétez votre formation active à 100% pour débloquer votre certificat officiel reconnu par les établissements scolaires."}
                    </p>
                    {continueItem ? (
                      <div className="student-cert-milestone-track">
                        <div className="student-cert-milestone-bar">
                          <div
                            className="student-cert-milestone-fill"
                            style={{ width: `${Math.min(100, Math.max(0, continueItem.progress))}%`, background: "#0056D2" }}
                          />
                        </div>
                        <span dir="ltr">{continueItem.progress}% complété</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Coursera Agenda & Tutoring */}
        <section className="student-agenda-panel" id="sessions" aria-labelledby="sessions-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="sessions-heading" className="student-panel-title">
                {ar ? "المواعيد والتوتورات" : "Agenda & Tutorat"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "جلساتك التفاعلية ومتابعاتك الميدانية." : "Vos sessions et webinaires programmés."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/rendez-vous`} className="student-panel-viewall">
              <span>{ar ? "مواعيدي" : "Mes créneaux"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {sessions.length > 0 ? (
            <div className="student-agenda-stack">
              {sessions.map((session) => {
                const dateParts = parseSessionDate(session.date, session.startAtRaw, locale);
                return (
                  <article key={session.id} className="student-agenda-item">
                    <div className="student-agenda-date-tile">
                      <span className="student-date-month">{dateParts.month}</span>
                      <span className="student-date-day">{dateParts.day}</span>
                    </div>

                    <div className="student-agenda-details">
                      <span className="student-agenda-type-pill">
                        {session.type === "webinar"
                          ? (ar ? "ندوة تفاعلية" : "Webinaire interactif")
                          : (ar ? "متابعة فردية" : "Suivi pédagogique")}
                      </span>
                      <h3 className="student-agenda-name">{session.title}</h3>
                      <p className="student-agenda-trainer">
                        <UserCheck size={14} className="text-[#0056D2]" />
                        <span>{session.trainer}</span>
                      </p>
                    </div>

                    {session.meetingUrl ? (
                      <a
                        href={session.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="student-agenda-join-btn"
                        aria-label={`${ar ? "انضمام إلى اللقاء" : "Rejoindre la visio"}: ${session.title}`}
                      >
                        <span>{ar ? "انضمام" : "Rejoindre"}</span>
                        <ExternalLink size={13} />
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="student-support-slot-card">
              <div className="student-support-slot-icon">
                <CalendarDays size={26} strokeWidth={1.75} />
              </div>
              <div className="student-support-slot-body">
                <h3>{ar ? "هل ترغب في جلسة متابعة فردية؟" : "Besoin d'un accompagnement personnalisé ?"}</h3>
                <p>
                  {ar
                    ? "احجز موعدًا فرديًا مع مستشار بيداغوجي لمناقشة أهدافك وصعوبات الميدان."
                    : "Réservez un échange de 30 min avec un tuteur pédagogique pour poser vos questions sur votre pratique."}
                </p>
                <Link href={`/${locale}/dashboard/rendez-vous`} className="student-support-slot-btn">
                  <CalendarDays size={15} />
                  <span>{ar ? "حجز موعد متابعة" : "Réserver un créneau"}</span>
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 5. COURSERA RESOURCES & TOOLKIT */}
      <div className="student-secondary-grid">
        {/* Left Column: Ressources Pratiques */}
        <section className="student-resources-panel" id="resources" aria-labelledby="resources-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="resources-heading" className="student-panel-title">
                {ar ? "الموارد والأدوات" : "Boîte à outils & Ressources"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "الوثائق والأدلة المتاحة لحسابك." : "Documents et fiches pratiques disponibles."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/ressources`} className="student-panel-viewall">
              <span>{ar ? "كل الموارد" : "Tout voir"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {resources.length > 0 ? (
            <div className="student-resources-stack">
              {resources.slice(0, 4).map((resource) => (
                <article key={resource.id} className="student-resource-item">
                  <div className="student-resource-icon-box" aria-hidden="true">
                    <BookOpen size={19} strokeWidth={1.8} />
                  </div>
                  <div className="student-resource-info">
                    <h3 className="student-resource-title">{resource.title}</h3>
                    <p className="student-resource-date">{resource.date}</p>
                  </div>
                  <a
                    href={`/api/resources/${resource.id}/download`}
                    className="student-resource-download-btn"
                    aria-label={`${ar ? "تحميل" : "Télécharger"}: ${resource.title}`}
                  >
                    <Download size={16} strokeWidth={2} />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title={ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"}
              body={ar ? "ستظهر الأدوات وجداول الرصد التي تحصل عليها هنا." : "Les guides et grilles d’observation apparaîtront ici."}
              action={{
                href: `/${locale}/bibliotheque`,
                label: ar ? "عرض المكتبة" : "Consulter la bibliothèque",
              }}
            />
          )}
        </section>

        {/* Right Column: Certificats & Validations */}
        <section className="student-certificates-panel" id="certificates" aria-labelledby="certificates-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="certificates-heading" className="student-panel-title">
                {ar ? "الشهادات والتحقق" : "Certificats & Validations"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "شهاداتك المعتمدة القابلة للتحقق الفوري." : "Titres officiels vérifiables par QR code."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/certificats`} className="student-panel-viewall">
              <span>{ar ? "شهاداتي" : "Tout voir"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {certificates.length > 0 ? (
            <div className="student-certificates-stack">
              {certificates.slice(0, 4).map((cert) => (
                <Link
                  key={cert.id}
                  href={`/${locale}/certificats/${cert.code}`}
                  className="student-certificate-item"
                >
                  <div className="student-certificate-seal" aria-hidden="true">
                    <Award size={22} strokeWidth={1.8} />
                  </div>
                  <div className="student-certificate-info">
                    <h3 className="student-certificate-title">{cert.title}</h3>
                    <span className="student-certificate-code" dir="ltr">
                      Réf: {cert.code}
                    </span>
                  </div>
                  <ChevronRight size={18} className="student-directional-icon text-[#7A7261]" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="student-cert-milestone-card">
              <div className="student-cert-milestone-seal">
                <Award size={30} strokeWidth={1.75} className="text-[#0056D2]" />
              </div>
              <div className="student-cert-milestone-body">
                <h3>{ar ? "مسار الحصول على الشهادة الرسمية" : "Parcours de certification officielle"}</h3>
                <p>
                  {ar
                    ? "أكمل دراسة دورتك التدريبية بنسبة 100% للحصول على شهادة معتمدة وموثقة برمز QR رسمي."
                    : "Complétez votre formation active à 100% pour débloquer votre certificat officiel reconnu par les établissements scolaires."}
                </p>
                {continueItem ? (
                  <div className="student-cert-milestone-track">
                    <div className="student-cert-milestone-bar">
                      <div
                        className="student-cert-milestone-fill"
                        style={{ width: `${Math.min(100, Math.max(0, continueItem.progress))}%`, background: "#0056D2" }}
                      />
                    </div>
                    <span dir="ltr">{continueItem.progress}% complété</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 6. COURSERA HELP & AI ASSISTANT BANNER */}
      <section className="student-bottom-banner" aria-label={ar ? "المساعدة والدعم" : "Aide et accompagnement"}>
        <div className="student-bottom-banner-icon" aria-hidden="true">
          <Sparkles size={22} className="text-[#0056D2]" />
        </div>
        <div className="student-bottom-banner-content">
          <h3>
            {ar
              ? "هل لديك سؤال أو تحتاج إلى مساعدة بيداغوجية؟"
              : "Une question sur votre cours ou un besoin d'accompagnement ?"}
          </h3>
          <p>
            {ar
              ? "مساعد ANEI الذكي وفريقنا البيداغوجي متاحون للإجابة على جميع استفساراتك وتوجيهك خطوة بخطوة."
              : "L'Assistant ANEI et nos référents pédagogiques sont à vos côtés pour vous guider vers la réussite."}
          </p>
        </div>
        <div className="student-bottom-banner-actions">
          <Link
            href={`/${locale}/dashboard?assistant=open`}
            className="student-banner-btn-gold"
          >
            <Sparkles size={16} />
            <span>{ar ? "فتح مساعد ANEI" : "Assistant ANEI"}</span>
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="student-banner-btn-ghost"
          >
            <HelpCircle size={16} />
            <span>{ar ? "التواصل مع الدعم" : "Contacter le support"}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
