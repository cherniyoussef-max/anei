"use client";

import { useParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default function StudentDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const ar = params.locale === "ar";
  return (
    <section className="student-dashboard-error" role="alert" aria-labelledby="student-error-title">
      <span aria-hidden="true"><ShieldAlert size={26} strokeWidth={1.75} /></span>
      <div><h1 id="student-error-title">{ar ? "تعذر تحميل مساحتك" : "Votre espace n’a pas pu être chargé"}</h1><p>{ar ? "لم نفقد جلستك. حاول تحميل بيانات التعلم مرة أخرى." : "Votre session est conservée. Réessayez de charger vos données d’apprentissage."}</p></div>
      <button type="button" onClick={reset}>{ar ? "إعادة المحاولة" : "Réessayer"}</button>
    </section>
  );
}
