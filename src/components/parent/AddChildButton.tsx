"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import type { Locale } from "@/types";
import { AddChildModal } from "@/components/parent/AddChildModal";

export function AddChildButton({
  locale,
  className = "",
  label,
  variant = "primary",
}: {
  locale: Locale;
  className?: string;
  label?: string;
  variant?: "primary" | "secondary" | "outline";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ar = locale === "ar";

  const defaultLabel = ar ? "إضافة طفل" : "Ajouter un enfant";

  const variantClasses =
    variant === "primary"
      ? "bg-[#0056D2] text-white hover:bg-[#00419E] shadow-xs"
      : variant === "secondary"
        ? "bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F1F5F9]"
        : "border border-[#E2E8F0] text-[#0056D2] bg-white hover:bg-[#F0F6FF]";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${variantClasses} ${className}`}
      >
        <UserPlus size={16} strokeWidth={2} />
        <span>{label ?? defaultLabel}</span>
      </button>

      <AddChildModal
        locale={locale}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
