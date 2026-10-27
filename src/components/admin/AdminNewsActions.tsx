"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Locale } from "@/types";

interface AdminNewsActionsProps {
  id: string;
  isFeatured: boolean;
  published: boolean;
  locale: Locale;
}

export function AdminNewsActions({
  id,
  isFeatured,
  published,
  locale,
}: AdminNewsActionsProps) {
  const ar = locale === "ar";
  const router = useRouter();
  const [loading, setLoading] = useState<"feature" | "publish" | null>(null);

  async function toggleFeatured() {
    setLoading("feature");
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: !isFeatured }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function togglePublished() {
    setLoading("publish");
    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Featured Toggle Button */}
      <button
        type="button"
        onClick={toggleFeatured}
        disabled={loading !== null}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-2xs border ${
          isFeatured
            ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
        }`}
        title={
          isFeatured
            ? ar
              ? "إلغاء التمييز في الصدارة"
              : "Retirer de la une"
            : ar
            ? "تمييز في الصدارة"
            : "Mettre à la une"
        }
      >
        {loading === "feature" ? (
          <Loader2 size={13} className="animate-spin text-amber-600" />
        ) : (
          <Star
            size={13}
            className={isFeatured ? "fill-amber-500 text-amber-600" : "text-slate-400"}
          />
        )}
        <span>
          {isFeatured
            ? ar
              ? "في الصدارة"
              : "À la une"
            : ar
            ? "تمييز"
            : "À la une"}
        </span>
      </button>

      {/* Publish Toggle Button */}
      <button
        type="button"
        onClick={togglePublished}
        disabled={loading !== null}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-2xs border ${
          published
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
        }`}
        title={
          published
            ? ar
              ? "تحويل إلى مسودة"
              : "Dépublier (passer en brouillon)"
            : ar
            ? "نشر المقال"
            : "Publier l'actualité"
        }
      >
        {loading === "publish" ? (
          <Loader2 size={13} className="animate-spin text-slate-500" />
        ) : published ? (
          <Eye size={13} className="text-emerald-600" />
        ) : (
          <EyeOff size={13} className="text-slate-400" />
        )}
        <span>
          {published
            ? ar
              ? "منشور"
              : "Publié"
            : ar
            ? "مسودة"
            : "Brouillon"}
        </span>
      </button>
    </div>
  );
}
