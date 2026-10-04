"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UserPlus,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartHandshake,
} from "lucide-react";
import type { Locale } from "@/types";

export type AddChildModalProps = {
  locale: Locale;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AddChildModal({
  locale,
  isOpen,
  onClose,
  onSuccess,
}: AddChildModalProps) {
  const ar = locale === "ar";
  const router = useRouter();

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationshipType, setRelationshipType] = useState<
    "MOTHER" | "FATHER" | "GUARDIAN" | "OTHER"
  >("FATHER");
  const [birthDate, setBirthDate] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [notes, setNotes] = useState("");
  const [existingStudentEmail, setExistingStudentEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload =
        mode === "new"
          ? {
              mode: "new",
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              relationshipType,
              birthDate: birthDate || undefined,
              schoolName: schoolName.trim() || undefined,
              educationLevel: educationLevel.trim() || undefined,
              specialNeeds: specialNeeds.trim() || undefined,
              notes: notes.trim() || undefined,
            }
          : {
              mode: "existing",
              relationshipType,
              existingStudentEmail: existingStudentEmail.trim().toLowerCase(),
            };

      const res = await fetch("/api/parent/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === "STUDENT_NOT_FOUND") {
          setErrorMessage(
            ar
              ? "لم يتم العثور على حساب تلميذ بهذا البريد الإلكتروني."
              : "Aucun compte élève trouvé avec cette adresse email."
          );
        } else if (data.error === "LINK_ALREADY_EXISTS") {
          setErrorMessage(
            ar
              ? "هذا الطفل مرتبط بالفعل بحسابك."
              : "Cet enfant est déjà associé à votre compte."
          );
        } else if (data.error === "NAME_REQUIRED") {
          setErrorMessage(
            ar
              ? "يرجى كتابة الاسم واللقب بشكل صحيح."
              : "Veuillez renseigner le nom et le prénom de l'enfant."
          );
        } else {
          setErrorMessage(
            data.message ||
              (ar
                ? "حدث خطأ أثناء حفظ الملف. يرجى المحاولة مرة أخرى."
                : "Une erreur est survenue lors de l'enregistrement.")
          );
        }
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        ar
          ? "تمت إضافة ملف الطفل بنجاح وتفعيل مسار المتابعة!"
          : "Le profil de l'enfant a été ajouté avec succès !"
      );

      setTimeout(() => {
        router.refresh();
        onSuccess?.();
        onClose();
      }, 1200);
    } catch {
      setErrorMessage(
        ar
          ? "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك."
          : "Impossible de contacter le serveur. Vérifiez votre connexion."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-child-title"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="relative border-b border-[#E2E8F0] bg-white px-6 py-5 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 rtl:right-auto rtl:left-5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
            aria-label={ar ? "إغلاق" : "Fermer"}
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 text-[#0056D2]">
            <HeartHandshake size={18} strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {ar ? "مساحة الوالدين" : "Espace Famille"}
            </span>
          </div>
          <h2
            id="add-child-title"
            className="mt-1 text-xl font-bold tracking-tight text-[#0F172A]"
          >
            {ar ? "إضافة أو ربط طفل" : "Ajouter ou associer un enfant"}
          </h2>
          <p className="mt-1 text-xs text-[#64748B] leading-relaxed">
            {ar
              ? "سجّل بيانات طفلك لتفعيل ملفه التربوي الفردي (PPS)، متابعة الحصص، والتواصل مع الأخصائيين."
              : "Renseignez les informations de votre enfant pour activer son dossier PPS et l'accès à son équipe soignante."}
          </p>

          {/* Mode Switch Tabs */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("new");
                setErrorMessage("");
              }}
              className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs font-semibold leading-tight transition ${
                mode === "new"
                  ? "bg-[#0056D2] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <UserPlus size={15} className="flex-none" />
              <span>{ar ? "ملف جديد للطفل" : "Nouveau profil enfant"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("existing");
                setErrorMessage("");
              }}
              className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs font-semibold leading-tight transition ${
                mode === "existing"
                  ? "bg-[#0056D2] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <LinkIcon size={15} className="flex-none" />
              <span>{ar ? "ربط حساب تلميذ موجود" : "Associer un compte existant"}</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 sm:px-8 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              <AlertCircle size={16} className="flex-none" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              <CheckCircle2 size={16} className="flex-none text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === "new" ? (
            <>
              {/* First & Last name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    {ar ? "الاسم الشخصي *" : "Prénom *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={ar ? "مثال: يوسف" : "Ex: Adam"}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    {ar ? "اللقب (اسم العائلة) *" : "Nom de famille *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={ar ? "مثال: الشارني" : "Ex: Ben Salem"}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                  />
                </div>
              </div>

              {/* Relationship & Birth date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    {ar ? "صلة القرابة *" : "Lien de parenté *"}
                  </label>
                  <select
                    value={relationshipType}
                    onChange={(e) =>
                      setRelationshipType(
                        e.target.value as "MOTHER" | "FATHER" | "GUARDIAN" | "OTHER"
                      )
                    }
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                  >
                    <option value="FATHER">{ar ? "الأب" : "Père"}</option>
                    <option value="MOTHER">{ar ? "الأم" : "Mère"}</option>
                    <option value="GUARDIAN">
                      {ar ? "الولي الشرعي / الوصي" : "Tuteur légal"}
                    </option>
                    <option value="OTHER">{ar ? "صلة قرابة أخرى" : "Autre lien"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    {ar ? "تاريخ الولادة" : "Date de naissance"}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                    />
                  </div>
                </div>
              </div>

              {/* School & Grade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    {ar ? "المؤسسة التربوية" : "Établissement scolaire"}
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder={ar ? "مثال: مدرسة حنبعل، تونس" : "Ex: École Pasteur, Tunis"}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    {ar ? "المستوى الدراسي" : "Niveau scolaire"}
                  </label>
                  <input
                    type="text"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    placeholder={ar ? "مثال: السنة الثالثة ابتدائي" : "Ex: CE2 / 3ème primaire"}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                  />
                </div>
              </div>

              {/* Special needs */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "الاحتياجات التربوية أو التشخيص (اختياري)" : "Besoins spécifiques ou diagnostic (optionnel)"}
                </label>
                <textarea
                  rows={2}
                  value={specialNeeds}
                  onChange={(e) => setSpecialNeeds(e.target.value)}
                  placeholder={
                    ar
                      ? "مثال: صعوبات تعلم (عسر قراءة/كتابة)، طيف توحد، تشتت انتباه، اضطراب لغوي..."
                      : "Ex: Troubles des apprentissages (Dyslexie/Dysorthographie), TDAH, TSA, retard de langage..."
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "ملاحظات أو توصيات إضافية" : "Remarques complémentaires"}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    ar
                      ? "أي معلومات تفيد الأخصائي أو المرافق المدرسي..."
                      : "Informations utiles pour l'AVS ou les spécialistes..."
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                />
              </div>
            </>
          ) : (
            <>
              {/* Existing Student Account Email */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "البريد الإلكتروني لحساب التلميذ *" : "Adresse email du compte élève *"}
                </label>
                <input
                  type="email"
                  required
                  value={existingStudentEmail}
                  onChange={(e) => setExistingStudentEmail(e.target.value)}
                  placeholder="eleve@domaine.com"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                />
                <p className="mt-1 text-[11px] text-[#64748B]">
                  {ar
                    ? "إذا كان لطفلك حساب تلميذ تم إنشاؤه مسبقاً في المنصة أو مدرسته، أدخل بريده للربط المباشر."
                    : "Si votre enfant a déjà un compte élève ANEI, renseignez son email pour lier instantanément votre profil."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "صلة القرابة *" : "Lien de parenté *"}
                </label>
                <select
                  value={relationshipType}
                  onChange={(e) =>
                    setRelationshipType(
                      e.target.value as "MOTHER" | "FATHER" | "GUARDIAN" | "OTHER"
                    )
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden transition"
                >
                  <option value="FATHER">{ar ? "الأب" : "Père"}</option>
                  <option value="MOTHER">{ar ? "الأم" : "Mère"}</option>
                  <option value="GUARDIAN">
                    {ar ? "الولي الشرعي / الوصي" : "Tuteur légal"}
                  </option>
                  <option value="OTHER">{ar ? "صلة قرابة أخرى" : "Autre lien"}</option>
                </select>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition disabled:opacity-50"
            >
              {ar ? "إلغاء" : "Annuler"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0056D2] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#00419E] transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{ar ? "جارٍ الحفظ..." : "Enregistrement..."}</span>
                </>
              ) : (
                <span>
                  {mode === "new"
                    ? ar
                      ? "إنشاء ملف الطفل"
                      : "Créer le profil enfant"
                    : ar
                      ? "ربط الحساب الآن"
                      : "Associer le compte"}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
