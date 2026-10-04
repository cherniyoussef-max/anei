"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, Loader2, AlertCircle } from "lucide-react";
import type { Locale } from "@/types";

export function UnlinkChildButton({
  linkId,
  childName,
  locale,
}: {
  linkId: string;
  childName: string;
  locale: Locale;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parent/children/${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || (ar ? "فشل إلغاء الربط" : "Échec de la dissociation"));
        setLoading(false);
        return;
      }
      setIsOpen(false);
      router.refresh();
    } catch {
      setError(ar ? "خطأ في الاتصال" : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 transition cursor-pointer"
        title={ar ? "إلغاء ربط الحساب" : "Dissocier le compte"}
      >
        <UserMinus size={12} />
        <span>{ar ? "إلغاء الربط" : "Dissocier"}</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#0F172A]">
              {ar ? "تأكيد إلغاء الربط" : "Confirmer la dissociation"}
            </h3>
            <p className="mt-2 text-xs text-[#64748B] leading-relaxed">
              {ar
                ? `هل أنت متأكد من رغبتك في إلغاء ربط حساب الطفل (${childName})؟ لن تتمكن من متابعة ملفه التربوي حتى يعاد ربطه.`
                : `Êtes-vous sûr de vouloir dissocier le compte de l'enfant (${childName}) ? Vous ne pourrez plus consulter son dossier PPS jusqu'à une nouvelle association.`}
            </p>

            {error && (
              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                <AlertCircle size={14} className="flex-none" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                {ar ? "إلغاء" : "Annuler"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleUnlink}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>{ar ? "نعم، إلغاء الربط" : "Confirmer la dissociation"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
