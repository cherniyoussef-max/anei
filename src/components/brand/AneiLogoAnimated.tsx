"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Locale } from "@/types";
import styles from "./AneiLogoAnimated.module.css";

const SESSION_STORAGE_KEY = "anei_logo_animated_played";
const COOKIE_NAME = "anei_logo_played";
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 757;

export interface AneiLogoAnimatedProps {
  locale: Locale;
  priority?: boolean;
  className?: string;
  hasPlayedIntro?: boolean;
}

export function AneiLogoAnimated({
  locale,
  priority = true,
  className = "",
  hasPlayedIntro = false,
}: AneiLogoAnimatedProps) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const alreadyPlayed =
        hasPlayedIntro ||
        sessionStorage.getItem(SESSION_STORAGE_KEY) === "1" ||
        document.cookie.includes(`${COOKIE_NAME}=1`);
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!alreadyPlayed && !prefersReduced) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, "1");
        document.cookie = `${COOKIE_NAME}=1; path=/; max-age=86400; SameSite=Lax`;
        requestAnimationFrame(() => {
          if (active) {
            setShouldAnimate(true);
          }
        });
      }
    } catch {
      // In restricted iframes or strict storage environments, keep static
    }

    return () => {
      active = false;
    };
  }, [hasPlayedIntro]);

  const ar = locale === "ar";
  const altText = ar
    ? "الأكاديمية الوطنية للتربية الدامجة"
    : "Académie Nationale de l’Éducation Inclusive";

  return (
    <div
      className={`${styles.stage} ${shouldAnimate ? styles.animate : styles.staticLogo} ${className}`}
      role="img"
      aria-label={altText}
    >
      <div className={styles.wrapper}>
        {/* Layer 1: Shadow (below mark) */}
        <Image
          src="/brand/layers/layer-shadow.webp"
          alt=""
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          priority={priority}
          unoptimized
          className={styles.layerShadow}
          aria-hidden="true"
        />

        {/* Layer 2: Navy Mark (Left side of crest) */}
        <Image
          src="/brand/layers/layer-navy.webp"
          alt=""
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          priority={priority}
          unoptimized
          className={styles.layerNavy}
          aria-hidden="true"
        />

        {/* Layer 3: Gold Mark (Right side of crest) */}
        <Image
          src="/brand/layers/layer-gold.webp"
          alt=""
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          priority={priority}
          unoptimized
          className={styles.layerGold}
          aria-hidden="true"
        />

        {/* Layer 4: Arabic Text (Right-to-left reveal) */}
        <Image
          src="/brand/layers/layer-arabic.webp"
          alt=""
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          priority={priority}
          unoptimized
          className={styles.layerArabic}
          aria-hidden="true"
        />

        {/* Layer 5: French Text (Left-to-right reveal + fade) */}
        <Image
          src="/brand/layers/layer-french.webp"
          alt=""
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          priority={priority}
          unoptimized
          className={styles.layerFrench}
          aria-hidden="true"
        />

        {/* Gold Sheen sweep */}
        {shouldAnimate ? (
          <div className={styles.goldSheen} aria-hidden="true">
            <div className={styles.sheenBeam} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
