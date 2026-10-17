"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import { SPECIALIST_CATEGORY_LIST } from "@/lib/specialist-categories";
import { AdminSudoModal } from "@/components/admin/AdminSudoModal";

export type AdminUserPromotionPanelProps = {
  locale: Locale;
  userId: string;
  userName: string;
  currentPostStatus: string;
  qualifyingCourses: Array<{
    id: string;
    titleFr: string;
    titleAr: string;
    targetType: string | null;
    targetCategory: string | null;
    isEnrolled: boolean;
    isCompleted: boolean;
    progressPercent: number;
  }>;
  certificates: Array<{
    id: string;
    courseTitleFr: string;
    courseTitleAr: string;
    issuedAt: Date | string;
    code: string;
  }>;
};

export function AdminUserPromotionPanel({
  locale,
  userId,
  userName,
  currentPostStatus,
  qualifyingCourses,
  certificates,
}: AdminUserPromotionPanelProps) {
  const ar = locale === "ar";

  const [postStatus, setPostStatus] = useState<string>(currentPostStatus || "LEARNER_ONLY");
  const [targetType, setTargetType] = useState<"AVS" | "SPECIALIST">("SPECIALIST");
  const [targetCategory, setTargetCategory] = useState<string>("ORTHOPHONISTE");
  const [interviewStatus, setInterviewStatus] = useState<"NOT_SCHEDULED" | "SCHEDULED" | "PASSED" | "FAILED">("PASSED");
  const [interviewScore, setInterviewScore] = useState<number>(85);
  const [interviewNotes, setInterviewNotes] = useState<string>(
    "Entretien de validation des compétences et vérification des diplômes validé avec succès."
  );

  // Profile fields
  const [workplaceName, setWorkplaceName] = useState("");
  const [workplaceAddress, setWorkplaceAddress] = useState("");
  const [universityDegree, setUniversityDegree] = useState("Diplôme National d'État");
  const [licenseOrOrderNumber, setLicenseOrOrderNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("+216 ");
  const [whatsappPhone, setWhatsappPhone] = useState("+216 ");
  const [showPhonePublicly, setShowPhonePublicly] = useState(true);
  const [inPersonPriceTnd, setInPersonPriceTnd] = useState(45);
  const [onlinePriceTnd, setOnlinePriceTnd] = useState(40);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showSudoModal, setShowSudoModal] = useState(false);

  async function handlePromoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/admin/users/${userId}/promote-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDirectoryType: targetType,
          targetCategory: targetType === "AVS" ? "AVS" : targetCategory,
          professionalPostStatus:
            targetType === "AVS" ? "APPROVED_AVS" : "APPROVED_SPECIALIST",
          interviewStatus,
          interviewScore: Number(interviewScore) || null,
          interviewNotes,
          qualifyingCourseIds: qualifyingCourses.filter((c) => c.isCompleted).map((c) => c.id),
          displayName: userName,
          workplaceName: workplaceName || null,
          workplaceAddress: workplaceAddress || null,
          universityDegree: universityDegree || null,
          licenseOrOrderNumber: licenseOrOrderNumber || null,
          contactPhone: contactPhone.trim() !== "+216" ? contactPhone : null,
          whatsappPhone: whatsappPhone.trim() !== "+216" ? whatsappPhone : null,
          showPhonePublicly,
          inPersonPriceMillimes: inPersonPriceTnd * 1000,
          onlineVisioPriceMillimes: onlinePriceTnd * 1000,
          consultationDurationMinutes: 45,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.error === "SUDO_REQUIRED") {
          setShowSudoModal(true);
          return;
        }
        throw new Error(json.message || json.error || "Erreur de promotion");
      }

      setPostStatus(targetType === "AVS" ? "APPROVED_AVS" : "APPROVED_SPECIALIST");
      setSuccessMsg(
        ar
          ? `تمت ترقة المستخدم بنجاح إلى رتبة ${targetType === "AVS" ? "مرافق معتمد (AVS)" : "أخصائي معتمد"} وتحديث الدليل الوطني.`
          : `Utilisateur promu avec succès au rang de ${targetType === "AVS" ? "AVS Certifié" : "Spécialiste Agréé"} ! Profil publié dans l'annuaire.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Current Academic Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {ar ? "الحالة الأكاديمية والرتبة المهنية" : "Statut Académique & Titre Professionnel"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {ar
                ? "متابعة مسار التكوين، اجتياز المقابلة، والترقية إلى الدليل المهني."
                : "Parcours de qualification certifiant et agrément d'exercice ANEI."}
            </p>
          </div>

          <div>
            {postStatus === "APPROVED_SPECIALIST" ? (
              <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold inline-flex items-center gap-1.5">
                <Icon name="check" size={13} className="text-indigo-600" />
                <span>{ar ? "أخصائي معتمد" : "Spécialiste Agréé"}</span>
              </span>
            ) : postStatus === "APPROVED_AVS" ? (
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5">
                <Icon name="check" size={13} className="text-emerald-600" />
                <span>{ar ? "مرافق معتمد (AVS)" : "AVS Certifié"}</span>
              </span>
            ) : postStatus === "CANDIDATE_UNDER_REVIEW" ? (
              <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-1.5">
                <Icon name="clock" size={13} className="text-amber-600" />
                <span>{ar ? "ملف قيد المراجعة" : "Dossier en revue"}</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                {ar ? "متعلم فقط" : "Apprenant standard"}
              </span>
            )}
          </div>
        </div>

        {/* Qualifying Courses Matrix */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {ar ? "التكوينات المؤهلة للاعتماد" : "Formations qualifiantes requises"}
          </h4>
          {qualifyingCourses.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              {ar
                ? "لا توجد دورات مسجلة كمعيار اعتماد مهني."
                : "Aucune formation n'a été marquée comme qualifiante dans le catalogue."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {qualifyingCourses.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    c.isCompleted
                      ? "bg-emerald-50/60 border-emerald-200"
                      : c.isEnrolled
                      ? "bg-amber-50/60 border-amber-200"
                      : "bg-slate-50 border-slate-200 opacity-70"
                  }`}
                >
                  <div>
                    <strong className="block text-slate-800">
                      {ar ? c.titleAr : c.titleFr}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {c.isCompleted
                        ? ar ? "مكتملة 100%" : "Validée (100%)"
                        : c.isEnrolled
                        ? `${c.progressPercent}% en cours`
                        : ar ? "غير مسجل" : "Non inscrit"}
                    </span>
                  </div>

                  <div>
                    {c.isCompleted ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                        {ar ? "مؤهّل" : "Validé"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px]">
                        {ar ? "مطلوب" : "Requis"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Existing Certificates */}
        {certificates.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              {ar ? "الشهادات المحصل عليها" : "Certificats officiels obtenus"}
            </h4>
            <div className="flex flex-wrap gap-2">
              {certificates.map((cert) => (
                <span
                  key={cert.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[#082D55] text-xs font-semibold"
                >
                  <Icon name="award" size={13} className="text-[#082D55]" />
                  <span>{ar ? cert.courseTitleAr : cert.courseTitleFr}</span>
                  <span className="font-mono text-[10px] text-slate-400">({cert.code})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Promotion Action Form (Sudo protected) */}
      <form onSubmit={handlePromoteSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-base">
            {ar ? "قرار الترقية ومنح الاعتماد المهني" : "Décision d'Agrément & Promotion de Poste"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {ar
              ? "تحويل حساب المتعلم إلى ملف مهني منشور في الدليل الوطني (يتطلب تأكيد Mode Sudo)."
              : "Passe le compte en statut professionnel certifié et génère la fiche annuaire publique."}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {ar ? "الدليل والمسار المستهدف" : "Annuaire cible"}
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "AVS" | "SPECIALIST")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
            >
              <option value="SPECIALIST">
                {ar ? "دليل الأخصائيين (عيادات، أطباء، تقويم نطق...)" : "Annuaire des Spécialistes (Libéraux/Cliniciens)"}
              </option>
              <option value="AVS">
                {ar ? "دليل المرافقين المدرسيين (AVS)" : "Annuaire des Accompagnants Scolaires (AVS)"}
              </option>
            </select>
          </div>

          {/* Target Category if Specialist */}
          {targetType === "SPECIALIST" ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {ar ? "التخصص الإكلينيكي" : "Discipline clinique"}
              </label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              >
                {SPECIALIST_CATEGORY_LIST.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.labelFr} ({c.badgeAr})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {ar ? "تخصص المرافقة" : "Spécialité AVS"}
              </label>
              <input
                type="text"
                disabled
                value="Accompagnant de Vie Scolaire (AVS) Certifié"
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 cursor-not-allowed"
              />
            </div>
          )}

          {/* Interview Status */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {ar ? "حالة المقابلة الشفوية" : "Statut de l'entretien d'évaluation"}
            </label>
            <select
              value={interviewStatus}
              onChange={(e) => setInterviewStatus(e.target.value as "NOT_SCHEDULED" | "SCHEDULED" | "PASSED" | "FAILED")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
            >
              <option value="PASSED">{ar ? "ناجح ومصادق عليه (PASSED)" : "Validé avec succès (PASSED)"}</option>
              <option value="SCHEDULED">{ar ? "مبرمج قريباً (SCHEDULED)" : "Planifié (SCHEDULED)"}</option>
              <option value="FAILED">{ar ? "غير مؤهل (FAILED)" : "Non validé (FAILED)"}</option>
              <option value="NOT_SCHEDULED">{ar ? "غير مبرمج بعد" : "Non planifié"}</option>
            </select>
          </div>

          {/* Interview Score */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {ar ? "علامة التقييم (/100)" : "Note d'évaluation (/100)"}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={interviewScore}
              onChange={(e) => setInterviewScore(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
            />
          </div>

          {/* Interview Notes */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              {ar ? "ملاحظات وتفاصيل المقابلة والاعتماد" : "Observations et compte-rendu d'entretien"}
            </label>
            <textarea
              rows={2}
              value={interviewNotes}
              onChange={(e) => setInterviewNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
            />
          </div>
        </div>

        {/* Practice info */}
        <div className="pt-2 border-t border-slate-100 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {ar ? "بيانات الملف المهني المنشور" : "Paramètres du profil professionnel public"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "اسم العيادة أو المركز" : "Nom du cabinet / clinique"}
              </label>
              <input
                type="text"
                placeholder="Ex: Cabinet d'Orthophonie El Manar"
                value={workplaceName}
                onChange={(e) => setWorkplaceName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "العنوان الفعلي للعيادة" : "Adresse physique"}
              </label>
              <input
                type="text"
                placeholder="Ex: 14 Rue Ibn Khaldoun, Tunis"
                value={workplaceAddress}
                onChange={(e) => setWorkplaceAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "الشهادة أو الكلية" : "Diplôme / Faculté"}
              </label>
              <input
                type="text"
                value={universityDegree}
                onChange={(e) => setUniversityDegree(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "رقم التسجيل بالعمادة / الاعتماد" : "N° Ordre / Agrément"}
              </label>
              <input
                type="text"
                placeholder="Ex: TUN-ORD-2026-981"
                value={licenseOrOrderNumber}
                onChange={(e) => setLicenseOrOrderNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "الهاتف المهني المباشر" : "Téléphone pro"}
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "واتساب العيادة" : "WhatsApp pro"}
              </label>
              <input
                type="tel"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "تسعيرة الحصص الحضورية (DT)" : "Tarif Présentiel Cabinet (DT) — 0% frais"}
              </label>
              <input
                type="number"
                min={0}
                value={inPersonPriceTnd}
                onChange={(e) => setInPersonPriceTnd(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">
                {ar ? "تسعيرة الاستشارة المرئية (DT)" : "Tarif Visio en ligne (DT) — Séquestre 15%"}
              </label>
              <input
                type="number"
                min={0}
                value={onlinePriceTnd}
                onChange={(e) => setOnlinePriceTnd(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#082D55]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="showPhonePublicly"
              checked={showPhonePublicly}
              onChange={(e) => setShowPhonePublicly(e.target.checked)}
              className="rounded text-[#082D55] focus:ring-[#082D55]"
            />
            <label htmlFor="showPhonePublicly" className="text-xs text-slate-700">
              {ar
                ? "إظهار رقم الهاتف وواتساب للعموم في الدليل الوطني (مع علامة التوثيق ANEI)"
                : "Afficher publiquement le téléphone et WhatsApp sur la fiche praticien (avec badge Vérifié ANEI)"}
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="py-3 px-6 bg-[#082D55] hover:bg-[#0E3B6C] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#082D55] disabled:opacity-50"
          >
            <Icon name="award" size={16} />
            <span>
              {isSubmitting
                ? ar ? "جاري الترقية..." : "Enregistrement..."
                : ar
                ? "المصادقة على الترقية ونشر الملف بالدليل"
                : "Valider l'Agrément & Promouvoir"}
            </span>
          </button>
        </div>
      </form>

      {/* Sudo Modal */}
      {showSudoModal && (
        <AdminSudoModal
          locale={locale}
          isOpen={showSudoModal}
          onSuccess={() => {
            setShowSudoModal(false);
            // Re-trigger submit
          }}
          onCancel={() => setShowSudoModal(false)}
        />
      )}
    </div>
  );
}
