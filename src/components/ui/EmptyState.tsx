import Link from "next/link";
import { type LucideIcon, Search, AlertCircle, BookOpen, UserX, Calendar } from "lucide-react";
import type { Locale } from "@/types";

export type EmptyStateProps = {
  locale?: Locale;
  title: string;
  description: string;
  icon?: "search" | "calendar" | "course" | "book" | "user" | "alert";
  action?: {
    label: string;
    href: string;
    external?: boolean;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

const ICON_MAP: Record<string, LucideIcon> = {
  search: Search,
  calendar: Calendar,
  course: BookOpen,
  book: BookOpen,
  user: UserX,
  alert: AlertCircle,
};

export function EmptyState({
  locale = "fr",
  title,
  description,
  icon = "search",
  action,
  secondaryAction,
}: EmptyStateProps) {
  const IconComponent = ICON_MAP[icon] || Search;
  const isRtl = locale === "ar";

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full text-center py-12 px-6 sm:py-16 sm:px-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 my-6 transition-all"
    >
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs text-[#0b1f4b] grid place-items-center mx-auto mb-4">
        <IconComponent size={26} strokeWidth={1.8} className="text-[#0b1f4b]" aria-hidden="true" />
      </div>

      <h3 className="text-lg sm:text-xl font-bold font-sans text-slate-900 mb-2 tracking-tight">
        {title}
      </h3>

      <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Link
              href={action.href}
              prefetch={true}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0b1f4b] hover:bg-[#1b3a7a] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
            >
              <span>{action.label}</span>
              <span aria-hidden="true" className={isRtl ? "rotate-180" : ""}>
                &rarr;
              </span>
            </Link>
          )}

          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              prefetch={true}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
            >
              <span>{secondaryAction.label}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
