import type { ReactNode } from "react";
import { Info } from "lucide-react";

interface AdminSectionCardProps {
  title: string;
  subtitle?: string;
  infoTooltip?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function AdminSectionCard({
  title,
  subtitle,
  infoTooltip,
  headerActions,
  children,
  className = "",
  bodyClassName = "",
}: AdminSectionCardProps) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs ${className}`}>
      <div className="px-5 py-3 bg-[#F8FAFC] border-b border-slate-200/80 flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <h2 className="text-[13px] font-semibold text-[#0A192F] flex items-center gap-1.5 tracking-tight">
            <span>{title}</span>
            {infoTooltip && (
              <span title={infoTooltip} className="inline-flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-help">
                <Info className="h-3.5 w-3.5" />
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="text-[11.5px] text-slate-500 mt-0.5 font-normal truncate">
              {subtitle}
            </p>
          )}
        </div>
        {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
      </div>
      <div className={`p-5 bg-white ${bodyClassName}`}>{children}</div>
    </section>
  );
}
