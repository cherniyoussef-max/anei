"use client";

interface PillOption {
  value: string;
  label: string;
}

interface AdminPillFilterProps {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  className?: string;
}

export function AdminPillFilter({
  options,
  value,
  onChange,
  className = "",
}: AdminPillFilterProps) {
  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`} role="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`h-8 px-3.5 rounded-md text-[13px] transition-all cursor-pointer select-none ${
              active
                ? "border border-[#0056D2] bg-[#EFF6FF] font-semibold text-[#0056D2] shadow-2xs"
                : "border border-slate-200 bg-[#F8FAFC] hover:bg-slate-100 font-medium text-[#0A192F]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
