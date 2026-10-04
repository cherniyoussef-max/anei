import type { LucideIcon } from "lucide-react";

export function PersonaMetricCard({
  icon: MetricIcon,
  tone: _tone,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  tone?: "navy" | "gold" | "cream" | "blue" | "emerald";
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
      <span
        className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#F0F6FF] text-[#0056D2] border border-[#BFDBFE]"
        aria-hidden="true"
      >
        <MetricIcon size={20} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-[#0F172A]" dir="ltr">
          {value}
        </p>
        {sub ? <p className="mt-0.5 truncate text-xs text-[#94A3B8]">{sub}</p> : null}
      </div>
    </div>
  );
}

export function PersonaPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
        <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PersonaRow({
  icon: RowIcon,
  title,
  meta,
  trailing,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 border-t border-[#F1F5F9] py-3.5 first:border-t-0 first:pt-0">
      <span
        className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-[#F0F6FF] text-[#0056D2]"
        aria-hidden="true"
      >
        <RowIcon size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-[#0F172A]">{title}</strong>
        {meta ? <div className="mt-0.5 text-xs text-[#64748B]">{meta}</div> : null}
      </div>
      {trailing}
    </li>
  );
}
