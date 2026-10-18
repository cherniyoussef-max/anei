import type { Locale } from "@/types";

export function AdminPageHeader({
  locale,
  eyebrow,
  title,
  description,
  actions,
}: {
  locale: Locale;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const ar = locale === "ar";

  return (
    <header className="pb-6 mb-6 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4" dir={ar ? "rtl" : "ltr"}>
      <div className="min-w-0">
        {eyebrow && (
          <span className="text-[11px] font-bold text-[#0056D2] uppercase tracking-wider mb-1 block">
            {eyebrow}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-[#0A192F] tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-slate-500 max-w-3xl mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
