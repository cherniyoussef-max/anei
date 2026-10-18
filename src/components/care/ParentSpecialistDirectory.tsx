"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, MapPin, UserCheck, ShieldCheck, AlertCircle, Clock, CheckCircle2, XCircle, MessageSquare, X } from "lucide-react";
import type { Locale } from "@/types";
import type { SpecialistDirectoryItem } from "@/server/queries/care-relationships";
import { TUNISIA_LOCATIONS } from "@/lib/tunisia/locations";

type LinkedChild = {
  id: string;
  name: string;
};

type ParentRequestItem = {
  id: string;
  status: string;
  requestMessage: string | null;
  declineReason: string | null;
  endReason: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  conversationId: string | null;
  child: { id: string; firstName: string };
  specialist: { id: string; name: string; specialty: string | null; avatarUrl: string | null };
};

export function ParentSpecialistDirectory({
  locale,
  initialSpecialists,
  linkedChildren,
  existingRequests,
}: {
  locale: Locale;
  initialSpecialists: SpecialistDirectoryItem[];
  linkedChildren: LinkedChild[];
  existingRequests: ParentRequestItem[];
}) {
  const ar = locale === "ar";
  const router = useRouter();

  // Filter state
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("ALL");
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"directory" | "requests">("directory");

  // Modal state
  const [selectedSpecialist, setSelectedSpecialist] = useState<SpecialistDirectoryItem | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>(linkedChildren[0]?.id ?? "");
  const [requestMessage, setRequestMessage] = useState<string>("");
  const [consentAccepted, setConsentAccepted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // End relationship modal
  const [endTargetId, setEndTargetId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string>("");
  const [ending, setEnding] = useState<boolean>(false);

  // Filter specialists client-side for smooth interaction
  const filteredSpecialists = initialSpecialists.filter((s) => {
    if (selectedSpecialty !== "ALL" && s.specialty !== selectedSpecialty) return false;
    if (selectedGovernorate !== "ALL" && s.governorate !== selectedGovernorate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchCity = s.city ? s.city.toLowerCase().includes(q) : false;
      const matchSpec = s.specialty ? s.specialty.toLowerCase().includes(q) : false;
      if (!matchName && !matchCity && !matchSpec) return false;
    }
    return true;
  });

  const availableSpecialties = Array.from(
    new Set(initialSpecialists.map((s) => s.specialty).filter((s): s is string => Boolean(s))),
  );

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSpecialist || !selectedChildId) return;
    if (!consentAccepted) {
      setErrorMessage(
        ar
          ? "الموافقة على مشاركة المعلومات إلزامية للمتابعة."
          : "Le consentement au partage des informations est obligatoire.",
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/care/relationships/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialistUserId: selectedSpecialist.userId,
          studentUserId: selectedChildId,
          requestMessage: requestMessage.trim() || null,
          consentAccepted: true,
          consentVersion: "v1.0",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "ALREADY_EXISTS") {
          setErrorMessage(
            ar
              ? "يوجد بالفعل طلب معلق أو متابعة نشطة لهذا الطفل مع هذا الأخصائي."
              : "Une demande en attente ou un suivi actif existe déjà pour cet enfant avec ce spécialiste.",
          );
        } else if (data.error === "FORBIDDEN_STUDENT") {
          setErrorMessage(
            ar
              ? "لا يمكنك تقديم طلب إلا لأبنائك المرتبطين بحسابك."
              : "Vous ne pouvez faire une demande que pour un enfant lié à votre compte.",
          );
        } else {
          setErrorMessage(
            ar
              ? "تعذر إرسال الطلب. يرجى المحاولة مرة أخرى."
              : "Impossible d'envoyer la demande. Veuillez réessayer.",
          );
        }
        return;
      }

      setSuccessMessage(
        ar
          ? "تم إرسال طلب المتابعة بنجاح للأخصائي."
          : "Votre demande de suivi a été envoyée avec succès au spécialiste.",
      );
      setTimeout(() => {
        setSelectedSpecialist(null);
        setRequestMessage("");
        setConsentAccepted(false);
        setSuccessMessage(null);
        setActiveTab("requests");
        router.refresh();
      }, 1200);
    } catch {
      setErrorMessage(
        ar ? "Erreur réseau. يرجى المحاولة لاحقاً." : "Erreur de connexion. Veuillez réessayer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEndRelationship(e: React.FormEvent) {
    e.preventDefault();
    if (!endTargetId) return;

    setEnding(true);
    try {
      const res = await fetch(`/api/care/relationships/${endTargetId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: endReason.trim() || null }),
      });

      if (res.ok) {
        setEndTargetId(null);
        setEndReason("");
        router.refresh();
      }
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Header and Tab Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0056D2]">
            {ar ? "فريق الرعاية والمتابعة" : "Équipe d'accompagnement"}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            {ar ? "المختصون والمهنيون" : "Spécialistes & Professionnels"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {ar
              ? "ابحث عن أخصائي معتمد وقدم طلب متابعة لطفلك في إطار آمن وموثوق."
              : "Trouvez un spécialiste vérifié et initiez une prise en charge pour votre enfant en toute sécurité."}
          </p>
        </div>

        <div className="flex rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "directory"
                ? "bg-[#0056D2] text-white shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {ar ? "دليل المختصين" : "Annuaire"} ({filteredSpecialists.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "requests"
                ? "bg-[#0056D2] text-white shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {ar ? "طلبات المتابعة" : "Mes demandes"} ({existingRequests.length})
          </button>
        </div>
      </div>

      {activeTab === "directory" ? (
        <>
          {/* Filters Bar */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[#94A3B8]">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={ar ? "البحث بالاسم أو المدينة..." : "Recherche par nom, ville..."}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 ps-9 pe-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden"
                >
                  <option value="ALL">{ar ? "كل التخصصات" : "Toutes les spécialités"}</option>
                  {availableSpecialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedGovernorate}
                  onChange={(e) => setSelectedGovernorate(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden"
                >
                  <option value="ALL">{ar ? "كل الولايات" : "Tous les gouvernorats"}</option>
                  {TUNISIA_LOCATIONS.map((g) => (
                    <option key={g.code} value={g.nameFr}>
                      {g.nameFr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Specialists Grid */}
          {filteredSpecialists.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <UserCheck size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-semibold text-[#0F172A]">
                {ar ? "لا يوجد أخصائي يطابق معايير البحث" : "Aucun spécialiste ne correspond à vos critères"}
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {ar ? "جرب تعديل خيارات التصفية." : "Essayez de modifier vos filtres de recherche."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredSpecialists.map((s) => (
                <div
                  key={s.userId}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-[#0056D2]/40 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start gap-4">
                      {s.image ? (
                        <Image
                          src={s.image}
                          alt={s.name}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full object-cover border border-[#E2E8F0]"
                        />
                      ) : (
                        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[#F0F6FF] text-lg font-bold text-[#0056D2]">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate font-semibold text-[#0F172A]">{s.name}</h3>
                          <span
                            title={ar ? "حساب معتمد" : "Profil vérifié"}
                            className="text-[#0056D2]"
                          >
                            <ShieldCheck size={16} />
                          </span>
                        </div>
                        {s.specialty && (
                          <span className="inline-block mt-1 rounded-full bg-[#F0F6FF] px-2.5 py-0.5 text-xs font-semibold text-[#0056D2]">
                            {s.specialty}
                          </span>
                        )}
                        {(s.governorate || s.city) && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs text-[#64748B]">
                            <MapPin size={13} className="flex-none" />
                            <span>
                              {s.city ? `${s.city}, ` : ""}
                              {s.governorate}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {s.qualification && (
                      <p className="mt-3 text-xs text-[#64748B] line-clamp-1">
                        <strong className="font-semibold text-[#0F172A]">
                          {ar ? "المؤهل:" : "Qualification:"}
                        </strong>{" "}
                        {s.qualification}
                      </p>
                    )}

                    {(s.bioFr || s.bioAr) && (
                      <p className="mt-2 text-xs text-[#64748B] line-clamp-3 leading-relaxed">
                        {ar && s.bioAr ? s.bioAr : s.bioFr || s.bioAr}
                      </p>
                    )}

                    {s.consultationModes && s.consultationModes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {s.consultationModes.map((m) => (
                          <span
                            key={m}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {m === "IN_PERSON"
                              ? ar
                                ? "حضوري"
                                : "En cabinet"
                              : ar
                              ? "عن بعد"
                              : "En ligne"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#E2E8F0]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSpecialist(s);
                        setErrorMessage(null);
                      }}
                      className="w-full rounded-lg bg-[#0056D2] px-4 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-[#00419E] shadow-xs"
                    >
                      {ar ? "طلب متابعة" : "Demander un suivi"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Requests Tab */
        <div className="space-y-4">
          {existingRequests.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <Clock size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-semibold text-[#0F172A]">
                {ar ? "لا توجد طلبات متابعة حتى الآن" : "Aucune demande de suivi pour le moment"}
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {ar
                  ? "اختر أخصائياً من الدليل لطلب المتابعة."
                  : "Consultez l'annuaire pour faire une première demande de prise en charge."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              {existingRequests.map((req) => {
                const statusBadge =
                  req.status === "ACTIVE" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={13} />
                      {ar ? "نشط" : "Actif"}
                    </span>
                  ) : req.status === "PENDING" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <Clock size={13} />
                      {ar ? "قيد الانتظار" : "En attente"}
                    </span>
                  ) : req.status === "DECLINED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                      <XCircle size={13} />
                      {ar ? "مرفوض" : "Décliné"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                      {ar ? "منتهي" : "Terminé"}
                    </span>
                  );

                return (
                  <div key={req.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-semibold text-[#0F172A]">
                          {req.specialist.name}
                        </strong>
                        {req.specialist.specialty && (
                          <span className="text-xs text-[#0056D2]">({req.specialist.specialty})</span>
                        )}
                        {statusBadge}
                      </div>

                      <p className="mt-1 text-xs text-[#64748B]">
                        {ar ? "الطفل:" : "Enfant:"} <strong className="text-[#0F172A]">{req.child.firstName}</strong> •{" "}
                        {ar ? "أُرسل في:" : "Demandé le:"}{" "}
                        {new Date(req.createdAt).toLocaleDateString(ar ? "ar-TN" : "fr-TN", {
                          dateStyle: "medium",
                        })}
                      </p>

                      {req.requestMessage && (
                        <p className="mt-2 text-xs italic text-[#64748B] bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                          &ldquo;{req.requestMessage}&rdquo;
                        </p>
                      )}

                      {req.status === "DECLINED" && req.declineReason && (
                        <p className="mt-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg">
                          <strong className="font-semibold">{ar ? "سبب الاعتذار:" : "Motif:"}</strong>{" "}
                          {req.declineReason}
                        </p>
                      )}

                      {req.status === "ENDED" && req.endReason && (
                        <p className="mt-2 text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-lg">
                          <strong className="font-semibold">{ar ? "سبب الإنهاء:" : "Motif de fin:"}</strong>{" "}
                          {req.endReason}
                        </p>
                      )}
                    </div>

                    {req.status === "ACTIVE" && (
                      <div className="flex-none flex items-center gap-2 pt-2 sm:pt-0">
                        <Link
                          href={`/${locale}/parent/messages${req.conversationId ? `/${req.conversationId}` : ""}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
                        >
                          <MessageSquare size={13} />
                          <span>{ar ? "الرسائل" : "Messagerie"}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEndTargetId(req.id)}
                          className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          {ar ? "إنهاء المتابعة" : "Clôturer le suivi"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Request Modal */}
      {selectedSpecialist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A]">
                  {ar ? "طلب متابعة جديد" : "Demande de suivi"}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {ar ? "الأخصائي:" : "Spécialiste:"} <strong>{selectedSpecialist.name}</strong>
                  {selectedSpecialist.specialty ? ` (${selectedSpecialist.specialty})` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpecialist(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-md transition-colors flex items-center justify-center"
                aria-label={ar ? "إغلاق" : "Fermer"}
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle size={16} className="flex-none mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 size={16} className="flex-none mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "الطفل المعني بالطلب *" : "Enfant concerné *"}
                </label>
                {linkedChildren.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    {ar
                      ? "ليس لديك أطفال مسجلون في حسابك. يرجى إضافة طفلك أولاً."
                      : "Aucun enfant n'est lié à votre compte. Veuillez d'abord ajouter votre enfant."}
                  </p>
                ) : (
                  <select
                    value={selectedChildId}
                    onChange={(e) => setSelectedChildId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden"
                  >
                    {linkedChildren.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#0F172A]">
                    {ar ? "رسالة للأخصائي (اختياري)" : "Message au spécialiste (optionnel)"}
                  </label>
                  <span className="text-[11px] text-[#94A3B8]">{requestMessage.length}/1000</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder={
                    ar
                      ? "وضح باختصار سبب الطلب وتطلعاتكم دون تفاصيل طبية دقيقة..."
                      : "Expliquez brièvement le contexte et vos attentes (sans détails cliniques confidentiels)..."
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* Mandatory Consent Box */}
              <div className="rounded-lg border border-[#BFDBFE] bg-[#F0F6FF]/60 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#0056D2] focus:ring-[#0056D2]"
                  />
                  <span className="text-xs leading-relaxed text-[#1E3A8A]">
                    {ar
                      ? "أصرح للأخصائي المحدد بالاطلاع على المعلومات المتعلقة بالمتابعة التربوية والتعليمية لطفلي على منصة عني، في إطار المتابعة ووفقاً لسياسة الخصوصية وحماية البيانات."
                      : "J'autorise le spécialiste sélectionné à accéder aux informations relatives au suivi pédagogique de mon enfant sur la plateforme ANEI, conformément à la politique de confidentialité."}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSelectedSpecialist(null)}
                  disabled={submitting}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={submitting || linkedChildren.length === 0 || !consentAccepted}
                  className="rounded-lg bg-[#0056D2] px-5 py-2 text-xs font-semibold text-white hover:bg-[#00419E] shadow-xs disabled:opacity-50"
                >
                  {submitting
                    ? ar
                      ? "جارٍ الإرسال..."
                      : "Envoi..."
                    : ar
                    ? "تأكيد الطلب"
                    : "Confirmer la demande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Relationship Modal */}
      {endTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[#0F172A]">
              {ar ? "إنهاء المتابعة مع الأخصائي" : "Clôturer le suivi"}
            </h3>
            <p className="text-xs text-[#64748B]">
              {ar
                ? "هل أنت متأكد من رغبتك في إنهاء هذه المتابعة؟ سيتم تجميد المحادثة وجعلها للقراءة فقط."
                : "Êtes-vous sûr de vouloir mettre fin à ce suivi ? La messagerie associée sera conservée en lecture seule."}
            </p>

            <form onSubmit={handleEndRelationship} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "سبب الإنهاء (اختياري)" : "Motif de fin (optionnel)"}
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder={ar ? "سبب إنهاء المتابعة..." : "Précisez la raison de la clôture..."}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#0F172A] focus:border-[#0056D2] focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setEndTargetId(null)}
                  disabled={ending}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={ending}
                  className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  {ending ? (ar ? "جارٍ الإنهاء..." : "Clôture...") : ar ? "تأكيد الإنهاء" : "Confirmer la fin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
