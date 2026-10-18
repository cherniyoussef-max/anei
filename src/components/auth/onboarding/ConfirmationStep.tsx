import { CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

export function ConfirmationStep({ ar, onContinue }: { ar: boolean; onContinue: () => void }) {
  const ArrowIcon = ar ? ArrowLeft : ArrowRight;

  return (
    <div className="w-full text-center py-6" role="status" aria-live="polite">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mx-auto mb-5 shadow-xs">
        <ShieldCheck className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>{ar ? "تم إكمال الملف بنجاح" : "Profil validé avec succès"}</span>
      </div>

      <h2 className="text-2xl font-bold text-[#0A192F] tracking-tight mb-2">
        {ar ? "مرحبًا بك في المنصة!" : "Bienvenue sur ANEI !"}
      </h2>

      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
        {ar
          ? "تم حفظ بياناتك وتخصيص مسارك التعليمي. سننقلك الآن لتأكيد جلستك والبدء في استكشاف دوراتك."
          : "Vos informations sont enregistrées et votre espace est prêt. Nous vous accompagnons pour confirmer votre session et démarrer."}
      </p>

      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-sm font-semibold transition-all shadow-xs"
        onClick={onContinue}
      >
        <span>{ar ? "الانتقال إلى مساحتي" : "Accéder à mon espace"}</span>
        <ArrowIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
