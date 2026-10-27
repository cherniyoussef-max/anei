"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import type { Locale } from "@/types";

interface AdminNewsFormProps {
  locale: Locale;
  initialPost?: {
    id: string;
    slug: string;
    category: string;
    coverImageUrl?: string | null;
    isFeatured: boolean;
    tagFr: string;
    tagAr: string;
    titleFr: string;
    titleAr: string;
    excerptFr: string;
    excerptAr: string;
    contentFr: string;
    contentAr: string;
    published: boolean;
  };
  onSuccess?: () => void;
}

export function AdminNewsForm({ locale, initialPost, onSuccess }: AdminNewsFormProps) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(initialPost?.category || "FORMATION");

  const categories = [
    { value: "FORMATION", fr: "Formation", ar: "تكوين" },
    { value: "CERTIFICATION", fr: "Certification", ar: "مصادقة" },
    { value: "PARTENARIAT", fr: "Partenariat", ar: "شراكة" },
    { value: "EVENEMENT", fr: "Événement", ar: "فعاليات" },
    { value: "COMMUNIQUE", fr: "Communiqué", ar: "بلاغ مؤسساتي" },
  ];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setErrorMessage(null);

    const form = e.currentTarget;
    const f = new FormData(form);

    const payload = {
      slug: String(f.get("slug")).trim().toLowerCase(),
      category: String(f.get("category")),
      tagFr: String(f.get("tagFr")).trim() || undefined,
      tagAr: String(f.get("tagAr")).trim() || undefined,
      titleFr: String(f.get("titleFr")).trim(),
      titleAr: String(f.get("titleAr")).trim(),
      excerptFr: String(f.get("excerptFr")).trim(),
      excerptAr: String(f.get("excerptAr")).trim(),
      contentFr: String(f.get("contentFr")).trim(),
      contentAr: String(f.get("contentAr")).trim(),
      coverImageUrl: String(f.get("coverImageUrl")).trim() || null,
      isFeatured: f.get("isFeatured") === "on",
      published: f.get("published") === "on",
    };

    const endpoint = initialPost
      ? `/api/admin/news/${initialPost.id}`
      : "/api/admin/news";
    const method = initialPost ? "PATCH" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "OPERATION_FAILED");
      }

      setState("done");
      if (!initialPost) {
        form.reset();
      }
      router.refresh();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Erreur inattendue"
      );
    }
  }

  return (
    <form className="admin-course-form space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Catégorie */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>{ar ? "الفئة" : "Catégorie d'actualité"} *</span>
          </label>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
            required
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {ar ? cat.ar : cat.fr}
              </option>
            ))}
          </select>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>{ar ? "المعرف الرابط (Slug)" : "Identifiant URL (Slug)"} *</span>
          </label>
          <input
            name="slug"
            defaultValue={initialPost?.slug || ""}
            required
            pattern="[a-z0-9-]+"
            placeholder="nouvelle-actualite-inclusive"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
      </div>

      {/* Image de couverture */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          <span>{ar ? "رابط صورة الغلاف (اختياري)" : "URL de l'image de couverture (optionnel)"}</span>
        </label>
        <input
          name="coverImageUrl"
          type="url"
          defaultValue={initialPost?.coverImageUrl || ""}
          placeholder="https://images.unsplash.com/... ou /media/..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          {ar
            ? "في حال عدم توفر صورة، سيتم عرض تصميم رمزي أنيق مع شعار الأكاديمية تلقائيًا."
            : "Si aucune image n'est renseignée, un médaillon typographique épuré avec l'emblème de l'Académie s'affichera."}
        </p>
      </div>

      {/* Titres FR & AR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>Titre (Français) *</span>
          </label>
          <input
            name="titleFr"
            defaultValue={initialPost?.titleFr || ""}
            required
            placeholder="Lancement du nouveau programme..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>العنوان (العربية) *</span>
          </label>
          <input
            name="titleAr"
            dir="rtl"
            defaultValue={initialPost?.titleAr || ""}
            required
            placeholder="إطلاق البرنامج التدريبي الجديد..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
      </div>

      {/* Tags optionnels FR & AR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>Tag court FR (optionnel)</span>
          </label>
          <input
            name="tagFr"
            defaultValue={initialPost?.tagFr || ""}
            placeholder="Ex: Formation, Partenariat..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>الوسم المختصر AR (اختياري)</span>
          </label>
          <input
            name="tagAr"
            dir="rtl"
            defaultValue={initialPost?.tagAr || ""}
            placeholder="مثال: تكوين، شراكة..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
      </div>

      {/* Résumé court (Excerpt) FR & AR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>Résumé court FR (max 600 car.) *</span>
          </label>
          <textarea
            name="excerptFr"
            defaultValue={initialPost?.excerptFr || ""}
            rows={3}
            maxLength={600}
            required
            placeholder="Une phrase concise résumant l'annonce pour les cartes de découverte..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>المقتطف الموجز AR (600 حرف كحد أقصى) *</span>
          </label>
          <textarea
            name="excerptAr"
            dir="rtl"
            defaultValue={initialPost?.excerptAr || ""}
            rows={3}
            maxLength={600}
            required
            placeholder="موجز واضح يلخص الخبر لبطاقات التصفح..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
      </div>

      {/* Contenu complet FR & AR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>{ar ? "نص المقال الكامل (فرنسية) *" : "Corps de l’article FR *"}</span>
          </label>
          <textarea
            name="contentFr"
            defaultValue={initialPost?.contentFr || ""}
            rows={7}
            required
            placeholder="Rédigez l'article complet ici. Les retours à la ligne forment des paragraphes distincts..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            <span>نص المقال الكامل AR *</span>
          </label>
          <textarea
            name="contentAr"
            dir="rtl"
            defaultValue={initialPost?.contentAr || ""}
            rows={7}
            required
            placeholder="اكتب تفاصيل الخبر الكامل هنا مع الفقرات المنظمة..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>
      </div>

      {/* Options de visibilité */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            name="isFeatured"
            type="checkbox"
            defaultChecked={initialPost?.isFeatured || false}
            className="h-4 w-4 rounded border-slate-300 text-[#0056D2] focus:ring-[#0056D2]"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              {ar ? "تعيين في الصدارة (À LA UNE) على الصفحة الرئيسية وصفحة الأخبار" : "Mettre cet article à la une (À LA UNE)"}
            </span>
            <span className="text-[11px] text-slate-500">
              {ar
                ? "سيصبح هذا الخبر هو المقال الرئيسي المعروض في أعلى الصفحة ويلغي تمييز الخبر السابق تلقائيًا."
                : "Cet article remplacera automatiquement l'ancien article en vedette dans le bloc principal."}
            </span>
          </div>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer select-none pt-2 border-t border-slate-200/60">
          <input
            name="published"
            type="checkbox"
            defaultChecked={initialPost ? initialPost.published : true}
            className="h-4 w-4 rounded border-slate-300 text-[#0056D2] focus:ring-[#0056D2]"
          />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900">
              {ar ? "نشر الخبر مباشرة للعموم" : "Publier l'actualité immédiatement"}
            </span>
            <span className="text-[11px] text-slate-500">
              {ar
                ? "إذا لم يتم تحديده، فسيتم حفظه كمسودة غير مرئية للزوار."
                : "Si décoché, l'article sera conservé comme brouillon visible uniquement par l'équipe administrative."}
            </span>
          </div>
        </label>
      </div>

      {/* Bouton d'action */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-lg bg-[#0056D2] hover:bg-[#00419e] text-white px-5 py-2.5 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          {state === "loading"
            ? ar
              ? "جارٍ الحفظ..."
              : "Enregistrement..."
            : initialPost
            ? ar
              ? "حفظ التعديلات"
              : "Enregistrer les modifications"
            : ar
            ? "نشر الخبر الجديد"
            : "Publier l'actualité"}
        </button>

        {state === "done" && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            {ar ? "تم الحفظ بنجاح!" : "Actualité enregistrée avec succès !"}
          </span>
        )}

        {state === "error" && (
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
            {errorMessage || (ar ? "تعذر الحفظ. يرجى التحقق من المدخلات." : "Erreur lors de l'enregistrement.")}
          </span>
        )}
      </div>
    </form>
  );
}
