import Link from "next/link";
import type { Locale } from "@/types";

export function AdminFooter({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const base = `/${locale}/admin`;

  return (
    <footer className="mt-12 pt-8 pb-10 border-t border-slate-200/80 text-[12px] text-slate-500 flex flex-wrap items-center justify-between gap-4 select-none">
      <div className="flex items-center gap-1.5 text-slate-600">
        <span className="font-semibold text-[#0A192F]">ANEI</span>
        <span>•</span>
        <span>{ar ? "وحدة تحكم الإدارة الأكاديمية والتنفيذية" : "Console d’Administration Académique & Exécutive"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-slate-500">
        <Link href={`${base}/contacts`} className="hover:text-[#0056D2] transition-colors">
          {ar ? "الدعم والتواصل" : "Support"}
        </Link>
        <span>•</span>
        <Link href={`${base}/system`} className="hover:text-[#0056D2] transition-colors">
          {ar ? "حالة النظام" : "État du système"}
        </Link>
        <span>•</span>
        <Link href={`${base}/audit`} className="hover:text-[#0056D2] transition-colors">
          {ar ? "سجل العمليات" : "Journal d’audit"}
        </Link>
        <span>•</span>
        <span className="text-slate-400">© 2026 ANEI</span>
      </div>
    </footer>
  );
}
