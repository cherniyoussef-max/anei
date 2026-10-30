"use client";

import Image from "next/image";
import { useRef } from "react";
import type { Locale } from "@/types";
import { GoogleMark } from "@/components/auth/GoogleMark";
import type { ProfileTypeChoice, ProfileTypeItem } from "@/components/auth/RegisterWizard";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface RegisterRoleSelectionStepProps {
  locale: Locale;
  selectedRole: ProfileTypeChoice;
  onSelectRole: (role: ProfileTypeChoice) => void;
  onContinue: () => void;
  profiles: ProfileTypeItem[];
  googleConfigured?: boolean;
  onGoogleSignIn: () => void;
  googleLoading?: boolean;
  loading?: boolean;
}

export function RegisterRoleSelectionStep({
  locale,
  selectedRole,
  onSelectRole,
  onContinue,
  profiles,
  googleConfigured = false,
  onGoogleSignIn,
  googleLoading = false,
  loading = false,
}: RegisterRoleSelectionStepProps) {
  const ar = locale === "ar";
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = index;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      targetIndex = (index + 1) % profiles.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      targetIndex = (index - 1 + profiles.length) % profiles.length;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectRole(profiles[index].id);
      return;
    } else {
      return;
    }

    const nextProfile = profiles[targetIndex];
    if (nextProfile) {
      onSelectRole(nextProfile.id);
      itemRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="w-full">
      {/* Quick Google Sign-Up Banner */}
      {googleConfigured && (
        <div className="max-w-[460px] mx-auto mb-6 sm:mb-8">
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all shadow-2xs hover:border-slate-300 disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:outline-hidden"
          >
            <GoogleMark size={18} />
            <span>
              {googleLoading
                ? ar
                  ? "جارٍ الاتصال..."
                  : "Connexion en cours..."
                : ar
                  ? "التسجيل السريع باستخدام Google"
                  : "Inscription rapide avec Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-3.5 text-xs text-slate-400 uppercase font-medium tracking-wide">
              {ar
                ? "أو اختيار صفتك والتسجيل المخصص"
                : "ou choisir votre profil pour vous inscrire"}
            </span>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Grid on Desktop / Compact 1-Column on Mobile */}
      <div
        role="radiogroup"
        aria-label={
          ar
            ? "ما هي صفتكم داخل الأكاديمية؟"
            : "Quel est votre profil au sein de l'Académie ?"
        }
        className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 lg:gap-5 mb-8"
      >
        {profiles.map((p, index) => {
          const isSelected = selectedRole === p.id;

          return (
            <div
              key={p.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelectRole(p.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`group cursor-pointer p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex items-start sm:items-center gap-3.5 sm:gap-4 relative text-start select-none focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:ring-offset-2 outline-hidden ${
                isSelected
                  ? "border-[#0A192F] bg-blue-50/30 shadow-xs ring-1 ring-[#0A192F]/15 -translate-y-0.5"
                  : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60 hover:-translate-y-0.5"
              }`}
            >
              {/* Option A Editorial Vector Illustration Tile */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-xl overflow-hidden shrink-0 bg-slate-50 border border-slate-100/80 flex items-center justify-center p-1.5 transition-transform group-hover:scale-[1.02]">
                <Image
                  src={p.image}
                  alt={ar ? p.titleAr : p.titleFr}
                  width={104}
                  height={104}
                  className="w-full h-full object-contain"
                  priority={index < 2}
                />
              </div>

              {/* Role Body Details */}
              <div className="flex-1 min-w-0">
                {/* Title and Radio Selector */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm sm:text-base font-bold text-[#0A192F] group-hover:text-[#0056D2] transition-colors line-clamp-1">
                    {ar ? p.titleAr : p.titleFr}
                  </h3>
                  <span
                    aria-hidden="true"
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      isSelected
                        ? "border-[#0A192F] bg-[#0A192F] text-white"
                        : "border-slate-300 group-hover:border-slate-400 bg-white"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </span>
                </div>

                {/* Subtitle / Description */}
                <p className="text-xs text-slate-500 leading-relaxed mb-2.5 line-clamp-2">
                  {ar ? p.descriptionAr : p.descriptionFr}
                </p>

                {/* Editorial Tag Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {(ar ? p.badgesAr : p.badgesFr).map((badge, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold leading-tight ${
                        idx === 0
                          ? p.badgeColorClass
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Spacer for Mobile Sticky Bar to avoid covering the bottom card */}
      <div className="h-16 sm:hidden" aria-hidden="true" />

      {/* Bottom Continue Action Bar: Desktop Normal / Mobile Sticky */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 sm:static sm:p-0 sm:border-t sm:border-slate-100 sm:pt-4 sm:bg-transparent z-30 flex items-center justify-end shadow-lg sm:shadow-none pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm px-8 py-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0056D2] focus-visible:outline-hidden"
        >
          <span>{ar ? "متابعة" : "Continuer"}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}
