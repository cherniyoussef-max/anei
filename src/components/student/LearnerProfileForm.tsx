"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

const GOVERNORATES = ["Ariana","Béja","Ben Arous","Bizerte","Gabès","Gafsa","Jendouba","Kairouan","Kasserine","Kébili","Le Kef","Mahdia","La Manouba","Médenine","Monastir","Nabeul","Sfax","Sidi Bouzid","Siliana","Sousse","Tataouine","Tozeur","Tunis","Zaghouan"];

type Values = { firstName: string; lastName: string; country: string; governorate: string; city: string; preferredLocale: string; educationLevel: string; institutionName: string };

export function LearnerProfileForm({ locale, values }: { locale: Locale; values: Values }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("saving");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(["firstName","lastName","country","governorate","city","preferredLocale","educationLevel","institutionName"].map((key) => [key, String(form.get(key) ?? "").trim()]));
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(response.ok ? "done" : "error");
    if (response.ok) router.refresh();
  }
  return <form className="learner-profile-form" onSubmit={submit} aria-busy={state === "saving"}>
    <div className="learner-form-grid"><label><span>{ar ? "الاسم" : "Prénom"}</span><input name="firstName" defaultValue={values.firstName} required maxLength={80} /></label><label><span>{ar ? "اللقب" : "Nom"}</span><input name="lastName" defaultValue={values.lastName} required maxLength={80} /></label><label><span>{ar ? "الدولة" : "Pays"}</span><input name="country" defaultValue={values.country} required maxLength={80} /></label><label><span>{ar ? "الولاية" : "Gouvernorat"}</span><select name="governorate" defaultValue={values.governorate} required>{GOVERNORATES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>{ar ? "المدينة" : "Ville"}</span><input name="city" defaultValue={values.city} required maxLength={120} /></label><label><span>{ar ? "اللغة المفضلة" : "Langue préférée"}</span><select name="preferredLocale" defaultValue={values.preferredLocale}><option value="fr">Français</option><option value="ar">العربية</option></select></label><label><span>{ar ? "المستوى الدراسي" : "Niveau d’étude"}</span><input name="educationLevel" defaultValue={values.educationLevel} required maxLength={120} /></label><label><span>{ar ? "المؤسسة" : "Institution"}</span><input name="institutionName" defaultValue={values.institutionName} required maxLength={160} /></label></div>
    <div className="learner-form-actions"><button className="student-primary-action" disabled={state === "saving"}>{state === "saving" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ التغييرات" : "Enregistrer")}</button>{state === "done" ? <span className="success-inline" role="status">{ar ? "تم حفظ الملف." : "Profil enregistré."}</span> : state === "error" ? <span className="form-error" role="alert">{ar ? "تعذر حفظ الملف. تحقق من الحقول وحاول مجددًا." : "Impossible d’enregistrer. Vérifiez les champs et réessayez."}</span> : null}</div>
  </form>;
}
