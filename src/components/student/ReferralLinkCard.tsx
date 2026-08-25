"use client";

import { useState } from "react";
import type { Locale } from "@/types";

export function ReferralLinkCard({ locale, code }: { locale: Locale; code: string }) {
  const ar = locale === "ar";
  const [copied, setCopied] = useState(false);
  const path = `/${locale}/register?ref=${code}`;
  const href = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the link is still selectable/copyable manually.
    }
  }

  return <div className="student-continue-card">
    <div>
      <small>{ar ? "رابط الإحالة الخاص بك" : "Votre lien de parrainage"}</small>
      <strong dir="ltr" className="mono">{href}</strong>
    </div>
    <button type="button" className="btn btn-primary btn-sm" onClick={copy}>{copied ? (ar ? "تم النسخ" : "Copié") : (ar ? "نسخ الرابط" : "Copier le lien")}</button>
  </div>;
}
