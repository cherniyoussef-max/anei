"use client";

import type { Locale } from "@/types";

interface AuthWizardProgressProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepSubtitle: string;
  locale: Locale;
}

export function AuthWizardProgress({
  currentStep,
  totalSteps,
  stepTitle,
  stepSubtitle,
  locale,
}: AuthWizardProgressProps) {
  const ar = locale === "ar";
  const stepLabel = ar
    ? `المرحلة ${currentStep} من ${totalSteps}`
    : `ÉTAPE ${currentStep} SUR ${totalSteps}`;

  return (
    <div className="mb-8">
      {/* Segmented Horizontal Progress Bar */}
      <div
        className={`grid gap-2 mb-8 ${
          totalSteps === 4 ? "grid-cols-4" : totalSteps === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={stepLabel}
      >
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNumber = idx + 1;
          const isCompletedOrActive = stepNumber <= currentStep;
          return (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isCompletedOrActive ? "bg-[#0A192F]" : "bg-slate-200"
              }`}
            />
          );
        })}
      </div>

      {/* Step Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] rtl:tracking-normal text-[#0056D2] mb-2">
          {stepLabel}
        </p>
        <h1 className="text-3xl sm:text-[34px] font-bold text-[#0A192F] tracking-[-0.025em] rtl:tracking-normal leading-[1.18] rtl:leading-[1.36] mb-2.5">
          {stepTitle}
        </h1>
        <p className="text-base text-slate-500 leading-relaxed rtl:leading-[1.8]">
          {stepSubtitle}
        </p>
      </div>
    </div>
  );
}
