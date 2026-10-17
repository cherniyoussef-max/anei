"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

const GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Le Kef",
  "Mahdia",
  "La Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
];

type Values = {
  firstName: string;
  lastName: string;
  country: string;
  governorate: string;
  city: string;
  preferredLocale: string;
  educationLevel: string;
  institutionName: string;
};

export function LearnerProfileForm({
  locale,
  values,
}: {
  locale: Locale;
  values: Values;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [
        "firstName",
        "lastName",
        "country",
        "governorate",
        "city",
        "preferredLocale",
        "educationLevel",
        "institutionName",
      ].map((key) => [key, String(form.get(key) ?? "").trim()])
    );

    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setState(response.ok ? "done" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} aria-busy={state === "saving"} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Prénom */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "الاسم الشخصي" : "Prénom"}
          </label>
          <input
            name="firstName"
            defaultValue={values.firstName}
            required
            maxLength={80}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          />
        </div>

        {/* Nom */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "اللقب العائلي" : "Nom de famille"}
          </label>
          <input
            name="lastName"
            defaultValue={values.lastName}
            required
            maxLength={80}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          />
        </div>

        {/* Pays */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "الدولة" : "Pays de résidence"}
          </label>
          <input
            name="country"
            defaultValue={values.country}
            required
            maxLength={80}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          />
        </div>

        {/* Gouvernorat */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "الولاية" : "Gouvernorat"}
          </label>
          <select
            name="governorate"
            defaultValue={values.governorate}
            required
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          >
            {GOVERNORATES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Ville */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "المدينة / المعتمدية" : "Ville"}
          </label>
          <input
            name="city"
            defaultValue={values.city}
            required
            maxLength={120}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          />
        </div>

        {/* Langue préférée */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "لغة الواجهة المفضلة" : "Langue préférée"}
          </label>
          <select
            name="preferredLocale"
            defaultValue={values.preferredLocale}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          >
            <option value="fr">Français (FR)</option>
            <option value="ar">العربية (AR)</option>
          </select>
        </div>

        {/* Niveau d'étude */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "المستوى الدراسي / المهني" : "Niveau d'étude ou qualification"}
          </label>
          <input
            name="educationLevel"
            defaultValue={values.educationLevel}
            required
            maxLength={120}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          />
        </div>

        {/* Institution */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            {ar ? "المؤسسة التعليمية أو المهنية" : "Institution / École de rattachement"}
          </label>
          <input
            name="institutionName"
            defaultValue={values.institutionName}
            required
            maxLength={160}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#082D55] transition-all"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <button
          type="submit"
          disabled={state === "saving"}
          className="py-2.5 px-6 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
        >
          {state === "saving"
            ? ar
              ? "جارٍ الحفظ..."
              : "Enregistrement..."
            : ar
            ? "حفظ التغييرات"
            : "Enregistrer les modifications"}
        </button>

        {state === "done" && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg" role="status">
            {ar ? "تم حفظ التعديلات بنجاح." : "Modifications enregistrées avec succès."}
          </span>
        )}

        {state === "error" && (
          <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg" role="alert">
            {ar
              ? "تعذر حفظ الملف. تحقق من صحة الحقول وأعد المحاولة."
              : "Impossible d'enregistrer. Veuillez vérifier les champs."}
          </span>
        )}
      </div>
    </form>
  );
}
