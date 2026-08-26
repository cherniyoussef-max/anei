"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminCoursePublicationAction({ locale, courseId, published }: {
  locale: Locale;
  courseId: string;
  published: boolean;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function updatePublication() {
    const message = published
      ? (ar ? "هل تريد إلغاء نشر هذه الدورة؟" : "Dépublier cette formation ?")
      : (ar ? "هل تريد نشر هذه الدورة؟" : "Publier cette formation ?");
    if (!window.confirm(message)) return;
    setState("saving");
    const response = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !published }),
    });
    setState(response.ok ? "idle" : "error");
    if (response.ok) router.refresh();
  }

  return <span className="admin-publication-action">
    <button type="button" className={published ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"} disabled={state === "saving"} onClick={updatePublication}>
      {state === "saving" ? (ar ? "جارٍ التحديث..." : "Mise à jour...") : published ? (ar ? "إلغاء النشر" : "Dépublier") : (ar ? "نشر" : "Publier")}
    </button>
    {state === "error" ? <small role="alert" className="form-error">{ar ? "تعذر تحديث حالة النشر." : "Impossible de modifier la publication."}</small> : null}
  </span>;
}
