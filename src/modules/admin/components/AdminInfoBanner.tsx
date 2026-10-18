import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function AdminInfoBanner({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-[#BFDBFE] bg-[#EFF6FF]/90 px-4 py-2.5 flex items-center gap-2.5 text-[13px] font-medium text-[#1E40AF] ${className}`} role="status">
      <Info className="h-4 w-4 shrink-0 text-[#0056D2]" />
      <div className="flex-1 leading-snug">{children}</div>
    </div>
  );
}
