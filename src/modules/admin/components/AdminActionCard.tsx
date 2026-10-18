import type { ReactNode, ComponentType } from "react";
import Link from "next/link";

interface AdminActionCardProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function AdminActionCard({
  title,
  description,
  icon: IconComponent,
  badge,
  href,
  onClick,
  selected = false,
}: AdminActionCardProps) {
  const content = (
    <>
      <div className={`h-9 w-9 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
        selected
          ? "border-[#0056D2]/50 bg-[#EFF6FF] text-[#0056D2]"
          : "border-slate-200 bg-[#F8FAFC] text-slate-600 group-hover:border-[#0056D2]/30 group-hover:bg-[#0056D2]/[0.04] group-hover:text-[#0056D2]"
      }`}>
        <IconComponent className="h-4.5 w-4.5 stroke-[1.6]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-[#0A192F] truncate">{title}</span>
          {badge && (
            <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[11px] font-medium text-[#0056D2] shrink-0">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{description}</p>
      </div>
    </>
  );

  const containerClasses = `group rounded-lg border bg-white p-4 transition-all flex items-start gap-3.5 text-start cursor-pointer ${
    selected
      ? "border-[#0056D2] ring-1 ring-[#0056D2]/20 bg-[#F8FAFC]/90"
      : "border-slate-200 hover:border-[#0056D2]/60 hover:bg-[#F8FAFC]/60"
  }`;

  if (href) {
    return (
      <Link href={href} className={containerClasses}>
        {content}
      </Link>
    );
  }

  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick?.()} className={containerClasses}>
      {content}
    </div>
  );
}

export function AdminActionGrid({ children }: { children: ReactNode }) {
  return <div className="admin-dashboard-grid grid grid-cols-1 md:grid-cols-2 gap-3.5">{children}</div>;
}
