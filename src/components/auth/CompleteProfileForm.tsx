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
] as const;

const ERROR_MESSAGES: Record<string, { fr: string; ar: string }> = {
  must_be_at_least_18: { fr: "Vous devez avoir au moins 18 ans.", ar: "يجب أن يكون عمرك 18 سنة على الأقل." },
  birthDate_or_birthYear_required: { fr: "Merci d'indiquer votre date de naissance.", ar: "يرجى إدخال تاريخ ميلادك." },
};

const FIELD_LABELS: Record<string, { fr: string; ar: string }> = {
  firstName: { fr: "Prénom", ar: "الاسم" },
  lastName: { fr: "Nom", ar: "اللقب" },
  birthDate: { fr: "Date de naissance", ar: "تاريخ الميلاد" },
  phoneNumber: { fr: "Téléphone/WhatsApp (format +216XXXXXXXX)", ar: "الهاتف/واتساب (بصيغة +216XXXXXXXX)" },
  country: { fr: "Pays", ar: "الدولة" },
  governorate: { fr: "Gouvernorat", ar: "الولاية" },
  city: { fr: "Ville", ar: "المدينة" },
  educationLevel: { fr: "Niveau d'étude", ar: "المستوى الدراسي" },
  institutionName: { fr: "Institution", ar: "المؤسسة" },
};

function normalizePhoneNumber(value: string) {
  const digitsOnly = value.replace(/[^\d+]/g, "");
  if (digitsOnly.startsWith("+")) return digitsOnly;
  if (/^\d{8}$/.test(digitsOnly)) return `+216${digitsOnly}`;
  return digitsOnly;
}

type Persona = "STUDENT" | "AVS" | "PARENT" | "TEACHER" | "SPECIALIST" | "ORGANIZATION";

export function CompleteProfileForm({ locale, email, name, initialPersona }: { locale: Locale; email: string; name: string; initialPersona: Persona | null }) {
  const router = useRouter();
  const ar = locale === "ar";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [first = "", ...rest] = name.trim().split(/\s+/);
  const defaultFirstName = first || "";
  const defaultLastName = rest.join(" ") || "";

  const today = new Date();
  const maxBirthDate = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
  const minBirthDate = `${today.getUTCFullYear() - 120}-01-01`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const birthDateValue = String(form.get("birthDate") ?? "").trim();
    const phoneNumberValue = normalizePhoneNumber(String(form.get("phoneNumber") ?? "").trim());
    const payload = {
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      birthDate: birthDateValue ? new Date(`${birthDateValue}T00:00:00.000Z`).toISOString() : undefined,
      phoneNumber: phoneNumberValue,
      country: String(form.get("country") ?? "").trim(),
      governorate: String(form.get("governorate") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      preferredLocale: String(form.get("preferredLocale") ?? locale),
      requestedPersona: String(form.get("requestedPersona") ?? ""),
      educationLevel: String(form.get("educationLevel") ?? "").trim(),
      institutionName: String(form.get("institutionName") ?? "").trim(),
      termsAccepted: Boolean(form.get("termsAccepted")),
      privacyAccepted: Boolean(form.get("privacyAccepted")),
    };

    const response = await fetch("/api/auth/profile/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
      const birthDateCode = fieldErrors?.birthDate?.[0];
      const knownBirthDate = birthDateCode ? ERROR_MESSAGES[birthDateCode] : undefined;
      if (knownBirthDate) {
        setError(ar ? knownBirthDate.ar : knownBirthDate.fr);
      } else {
        const invalidField = fieldErrors ? Object.keys(fieldErrors).find((key) => fieldErrors[key]?.length) : undefined;
        const label = invalidField ? FIELD_LABELS[invalidField] : undefined;
        setError(
          label
            ? (ar ? `حقل «${label.ar}» غير صحيح.` : `Le champ « ${label.fr} » n'est pas valide.`)
            : data?.error || "PROFILE_SUBMIT_FAILED",
        );
      }
      setLoading(false);
      return;
    }

    router.push(`/${locale}/verification-channel`);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit} aria-busy={loading}>
      <label><span>Email</span><input type="email" value={email} disabled /></label>
      <label><span>{ar ? "الاسم" : "Prénom"}</span><input name="firstName" defaultValue={defaultFirstName} required maxLength={80} /></label>
      <label><span>{ar ? "اللقب" : "Nom"}</span><input name="lastName" defaultValue={defaultLastName} required maxLength={80} /></label>
      <label><span>{ar ? "تاريخ الميلاد" : "Date de naissance"}</span><input name="birthDate" type="date" min={minBirthDate} max={maxBirthDate} required /></label>
      <label><span>{ar ? "رقم الهاتف/واتساب" : "Téléphone/WhatsApp"}</span><input name="phoneNumber" type="tel" placeholder="+216XXXXXXXX" required /></label>
      <label><span>{ar ? "الدولة" : "Pays"}</span><input name="country" defaultValue="Tunisie" required /></label>
      <label><span>{ar ? "الولاية" : "Gouvernorat"}</span>
        <select name="governorate" defaultValue="" required>
          <option value="" disabled>{ar ? "اختر الولاية" : "Sélectionnez un gouvernorat"}</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label><span>{ar ? "المدينة" : "Ville"}</span><input name="city" required /></label>
      <label><span>{ar ? "اللغة المفضلة" : "Langue"}</span><select name="preferredLocale" defaultValue={locale}><option value="fr">Français</option><option value="ar">العربية</option></select></label>
      <label><span>{ar ? "الملف" : "Profil"}</span><select name="requestedPersona" defaultValue={initialPersona ?? ""} required>{initialPersona ? null : <option value="" disabled>{ar ? "اختر صفتك" : "Choisissez votre profil"}</option>}<option value="STUDENT">{ar ? "طالب" : "Étudiant"}</option><option value="AVS">AVS</option><option value="PARENT">{ar ? "ولي" : "Parent"}</option><option value="TEACHER">{ar ? "مدرس" : "Enseignant"}</option><option value="SPECIALIST">{ar ? "مختص" : "Spécialiste"}</option><option value="ORGANIZATION">{ar ? "مؤسسة" : "Institution"}</option></select></label>
      <label><span>{ar ? "المستوى الدراسي" : "Niveau d'étude"}</span><input name="educationLevel" maxLength={120} required /></label>
      <label><span>{ar ? "المؤسسة" : "Institution"}</span><input name="institutionName" maxLength={160} required /></label>
      <label><input type="checkbox" name="termsAccepted" required /> {ar ? "أوافق على الشروط" : "J'accepte les conditions"}</label>
      <label><input type="checkbox" name="privacyAccepted" required /> {ar ? "أوافق على سياسة الخصوصية" : "J'accepte la politique de confidentialité"}</label>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary btn-block" disabled={loading}>{loading ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ الملف" : "Enregistrer le profil")}</button>
    </form>
  );
}
