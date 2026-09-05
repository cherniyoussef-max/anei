"use client";

import { usePathname } from "next/navigation";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const ar = pathname?.startsWith("/ar") ?? false;
  const locale = ar ? "ar" : "fr";

  return (
    <section className="admin-status-page" role="alert">
      <div className="admin-status-card">
        <div className="admin-status-icon" aria-hidden="true">!</div>
        <h1>{ar ? "حدث خطأ" : "Une erreur est survenue"}</h1>
        <p>
          {ar
            ? "تعذّر على وحدة التحكم إتمام هذا الإجراء. أعد المحاولة أو ارجع إلى الصفحة الرئيسية للإدارة."
            : "La console d’administration n’a pas pu terminer cette action. Réessayez ou revenez à l’accueil de l’administration."}
        </p>
        <div className="admin-status-actions">
          <button className="admin-primary-button" type="button" onClick={reset}>{ar ? "إعادة المحاولة" : "Réessayer"}</button>
          <a className="admin-exit-link" href={`/${locale}/admin`}>{ar ? "العودة إلى الإدارة" : "Retour à l’administration"}</a>
        </div>
      </div>
    </section>
  );
}
