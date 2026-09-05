import type { LucideIcon } from "lucide-react";

export function PersonaMetricCard({ icon: MetricIcon, tone, label, value, sub }: { icon: LucideIcon; tone: "navy" | "gold" | "cream"; label: string; value: React.ReactNode; sub?: string }) {
  const toneClass = tone === "gold" ? "bg-[#C9913F]/15 text-[#a9752f]" : tone === "cream" ? "bg-[#F6F1E7] text-[#082D55]" : "bg-[#082D55]/10 text-[#082D55]";
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#E7E0D3] bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
      <span className={`grid h-12 w-12 flex-none place-items-center rounded-xl ${toneClass}`} aria-hidden="true"><MetricIcon size={22} strokeWidth={1.75} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#7a7261]">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-[#082D55]" dir="ltr">{value}</p>
        {sub ? <p className="mt-0.5 truncate text-xs text-[#a39c8a]">{sub}</p> : null}
      </div>
    </div>
  );
}

export function PersonaPanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E7E0D3] bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[#082D55]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PersonaRow({ icon: RowIcon, title, meta, trailing }: { icon: LucideIcon; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 border-t border-[#E7E0D3] py-4 first:border-t-0 first:pt-0">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#F6F1E7] text-[#082D55]" aria-hidden="true"><RowIcon size={19} strokeWidth={1.75} /></span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-[#082D55]">{title}</strong>
        {meta ? <div className="mt-1 text-xs text-[#7a7261]">{meta}</div> : null}
      </div>
      {trailing}
    </li>
  );
}
