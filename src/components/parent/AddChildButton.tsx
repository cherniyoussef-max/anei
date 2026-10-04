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
      ? "bg-[#082D55] text-white hover:bg-[#061F3D] shadow-xs"
      : variant === "secondary"
        ? "bg-[#a9752f] text-white hover:bg-[#8f6225] shadow-xs"
        : "border border-[#082D55] text-[#082D55] bg-white hover:bg-[#F6F1E7]";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${variantClasses} ${className}`}
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
