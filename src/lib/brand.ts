import type { Locale } from "@/types";

export const FULL_LOGO_WIDTH = 3619;
export const FULL_LOGO_HEIGHT = 1772;
export const MARK_WIDTH = 2120;
export const MARK_HEIGHT = 1117;

export interface AneiLogoConfig {
  effectiveVariant: "full" | "mark";
  targetHeight: number;
  calculatedWidth: number;
  src: string;
  altText: string;
  shouldRenderText: boolean;
  isEnforcedMark: boolean;
  academyName: string;
}

export function getAneiLogoConfig(
  locale: Locale,
  variant: "full" | "mark" = "full",
  height?: number,
  withText = false,
  forceVariant = false,
): AneiLogoConfig {
  const ar = locale === "ar";
  const altText = ar
    ? "الأكاديمية الوطنية للتربية الدامجة"
    : "Académie Nationale de l’Éducation Inclusive";

  const defaultHeight = variant === "full" ? 72 : 40;
  const targetHeight = height ?? defaultHeight;

  // Rule 3: full logo only when rendered at >= 72px tall; below that use "mark" + real text unless forceVariant is true
  const isEnforcedMark = !forceVariant && variant === "full" && targetHeight < 72;
  const effectiveVariant = isEnforcedMark ? "mark" : variant;
  const shouldRenderText = withText || isEnforcedMark;

  let calculatedWidth = 0;
  let src = "";

  if (effectiveVariant === "full") {
    calculatedWidth = Math.round(targetHeight * (FULL_LOGO_WIDTH / FULL_LOGO_HEIGHT));
    src = "/brand/anei-logo-trimmed-2x.webp";
  } else {
    calculatedWidth = Math.round(targetHeight * (MARK_WIDTH / MARK_HEIGHT));
    src = "/brand/anei-mark-trimmed-2x.webp";
  }

  const academyName = ar
    ? "الأكاديمية الوطنية للتربية الدامجة"
    : "Académie Nationale de l’Éducation Inclusive";

  return {
    effectiveVariant,
    targetHeight,
    calculatedWidth,
    src,
    altText,
    shouldRenderText,
    isEnforcedMark,
    academyName,
  };
}
