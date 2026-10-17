import Image from "next/image";
import type { Locale } from "@/types";
import { getAneiLogoConfig } from "@/lib/brand";

export interface AneiLogoProps {
  locale: Locale;
  variant?: "full" | "mark";
  height?: number;
  priority?: boolean;
  className?: string;
  withText?: boolean;
  textClassName?: string;
  forceVariant?: boolean;
  twoLineText?: boolean;
}

export function AneiLogo({
  locale,
  variant = "full",
  height,
  priority = false,
  className = "",
  withText = false,
  textClassName = "",
  forceVariant = false,
  twoLineText = false,
}: AneiLogoProps) {
  const ar = locale === "ar";
  const en = locale === "en";
  const config = getAneiLogoConfig(locale, variant, height, withText, forceVariant);

  if (config.effectiveVariant === "full") {
    return (
      <span className={`inline-flex items-center flex-none ${className}`}>
        <Image
          src={config.src}
          alt={config.altText}
          width={config.calculatedWidth}
          height={config.targetHeight}
          priority={priority}
          unoptimized
          style={{ height: `${config.targetHeight}px`, width: "auto" }}
          className="object-contain block"
        />
      </span>
    );
  }

  // Mark variant
  return (
    <span className={`inline-flex items-center gap-3 flex-none ${className}`}>
      <Image
        src={config.src}
        alt={config.altText}
        width={config.calculatedWidth}
        height={config.targetHeight}
        priority={priority}
        unoptimized
        style={{ height: `${config.targetHeight}px`, width: "auto" }}
        className="object-contain flex-none block"
      />
      {config.shouldRenderText ? (
        twoLineText ? (
          <span className={`flex flex-col justify-center leading-tight min-w-0 ${textClassName}`}>
            <span
              className="font-bold tracking-tight text-[#082d55] text-[15px] sm:text-[16.5px] leading-[1.18] font-sans"
            >
              {ar ? "الأكاديمية الوطنية" : en ? "National Academy" : "Académie Nationale"}
            </span>
            <span className="text-[10.5px] sm:text-[11.5px] font-semibold text-[#a66f24] tracking-wider leading-[1.2] mt-0.5">
              {ar ? "للتربية الدامجة · ANEI" : en ? "of Inclusive Education · ANEI" : "de l’Éducation Inclusive · ANEI"}
            </span>
          </span>
        ) : (
          <span className={`flex flex-col leading-tight min-w-0 ${textClassName}`}>
            <span
              className="font-bold tracking-tight text-[#082d55] text-sm md:text-base font-sans"
            >
              {config.academyName}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#c9913f]">
              ANEI
            </span>
          </span>
        )
      ) : null}
    </span>
  );
}

export { getAneiLogoConfig } from "@/lib/brand";
