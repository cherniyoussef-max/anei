"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

type UserCategory = "LEARNER" | "AVS" | "SPECIALIST";

export function AdminUserCategorySelect({
  userId,
  currentCategory,
  canEdit = true,
  locale = "fr",
  compact = false,
}: {
  userId: string;
  currentCategory: UserCategory | string;
  canEdit?: boolean;
  locale?: Locale;
  compact?: boolean;
}) {
  const router = useRouter();
  const ar = locale === "ar";

  // Normalize currentCategory
  const normalizedCategory: UserCategory =
    currentCategory === "AVS" || currentCategory === "APPROVED_AVS"
      ? "AVS"
      : currentCategory === "SPECIALIST" || currentCategory === "APPROVED_SPECIALIST"
      ? "SPECIALIST"
      : "LEARNER";

  const [category, setCategory] = useState<UserCategory>(normalizedCategory);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const getBadgeStyle = (cat: UserCategory) => {
    switch (cat) {
      case "AVS":
        return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd", label: ar ? "AVS معتمد" : "AVS Certifié" };
      case "SPECIALIST":
        return { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe", label: ar ? "أخصائي معتمد" : "Spécialiste" };
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0", label: ar ? "متعلم" : "Apprenant" };
    }
  };

  if (!canEdit) {
    const badge = getBadgeStyle(category);
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          background: badge.bg,
          color: badge.text,
          border: `1px solid ${badge.border}`,
        }}
      >
        {badge.label}
      </span>
    );
  }

  async function handleCategoryChange(newCat: UserCategory) {
    if (newCat === category) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat }),
      });

      if (res.ok) {
        setCategory(newCat);
        setFeedback(ar ? "تم التحديث ✓" : "Modifié ✓");
        router.refresh();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback(err.message || (ar ? "فشل التحديث" : "Échec"));
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch {
      setFeedback(ar ? "خطأ اتصال" : "Erreur");
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  const badge = getBadgeStyle(category);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <select
        value={category}
        disabled={loading}
        onChange={(e) => handleCategoryChange(e.target.value as UserCategory)}
        style={{
          padding: compact ? "3px 6px" : "4px 8px",
          borderRadius: 6,
          border: `1px solid ${badge.border}`,
          background: badge.bg,
          color: badge.text,
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
          outline: "none",
        }}
      >
        <option value="LEARNER">{ar ? "🎓 متعلم (Learner)" : "🎓 Apprenant (Learner)"}</option>
        <option value="AVS">{ar ? "🤝 AVS معتمد (Scolaire)" : "🤝 AVS Certifié (Scolaire)"}</option>
        <option value="SPECIALIST">{ar ? "🩺 أخصائي معتمد (Clinique)" : "🩺 Spécialiste Inclusif (Clinique)"}</option>
      </select>

      {loading && (
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {ar ? "جارٍ الحفظ..." : "..."}
        </span>
      )}

      {feedback && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: feedback.includes("✓") ? "#16a34a" : "#dc2626",
          }}
        >
          {feedback}
        </span>
      )}
    </div>
  );
}
