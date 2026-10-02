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
}: AneiLogoProps) {
  const ar = locale === "ar";
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
    <span className={`inline-flex items-center gap-2.5 flex-none ${className}`}>
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
        <span className={`flex flex-col leading-tight min-w-0 ${textClassName}`}>
          <span
            className="font-bold tracking-tight text-[#082d55] text-sm md:text-base font-serif"
            style={{ fontFamily: ar ? undefined : "var(--font-fraunces), Georgia, serif" }}
          >
            {config.academyName}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#c9913f]">
            ANEI
          </span>
        </span>
      ) : null}
    </span>
  );
}

export { getAneiLogoConfig } from "@/lib/brand";
