"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import type { AvsProfileRow, AvsBookingRequestRow } from "@/server/db/schema";

export type AvsDashboardManagerProps = {
  locale: Locale;
  profile: AvsProfileRow | null;
  bookings: AvsBookingRequestRow[];
};

export function AvsDashboardManager({ locale, profile: initialProfile, bookings: initialBookings }: AvsDashboardManagerProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"bookings" | "calendar" | "profile">("bookings");
  const [bookings, setBookings] = useState<AvsBookingRequestRow[]>(initialBookings);
  const [profile, setProfile] = useState<AvsProfileRow | null>(initialProfile);
  const [bookingFilter, setBookingFilter] = useState<"ALL" | "PENDING" | "CONFIRMED" | "DECLINED">("ALL");

  // Profile form state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const [profileErrorMsg, setProfileErrorMsg] = useState("");

  // Calendar & Slot state
  const [selectedWorkingDays, setSelectedWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [consultationModes, setConsultationModes] = useState<("IN_PERSON" | "ONLINE")[]>(["IN_PERSON", "ONLINE"]);
  const [activeSlots, setActiveSlots] = useState<string[]>([
    "08:30 - 09:30",
    "09:30 - 10:30",
    "10:30 - 11:30",
    "14:00 - 15:00",
    "15:00 - 16:00",
    "16:00 - 17:00",
  ]);
  const [customSlotInput, setCustomSlotInput] = useState("");
  const [isSavingCalendar, setIsSavingCalendar] = useState(false);
  const [calendarSuccessMsg, setCalendarSuccessMsg] = useState("");
  const [calendarErrorMsg, setCalendarErrorMsg] = useState("");

  const [cityFr, setCityFr] = useState(profile?.cityFr || "Tunis");
  const [cityAr, setCityAr] = useState(profile?.cityAr || "تونس");
  const [governorateFr, setGovernorateFr] = useState(profile?.governorateFr || "Tunis");
  const [governorateAr, setGovernorateAr] = useState(profile?.governorateAr || "تونس");
  const [specialtyFr, setSpecialtyFr] = useState(profile?.specialtyFr || "Accompagnement scolaire spécialisé");
  const [specialtyAr, setSpecialtyAr] = useState(profile?.specialtyAr || "مرافقة مدرسية مختصة");
  const [availabilityFr, setAvailabilityFr] = useState(profile?.availabilityFr || "Disponible immédiatement");
  const [availabilityAr, setAvailabilityAr] = useState(profile?.availabilityAr || "متاح فورًا");
  const [hourlyRateTnd, setHourlyRateTnd] = useState(profile?.hourlyRateMillimes ? profile.hourlyRateMillimes / 1000 : 25);
  const [experienceYears, setExperienceYears] = useState(profile?.experienceYears || 4);
  const [phone, setPhone] = useState(profile?.phone || "+216 ");
  const [email, setEmail] = useState(profile?.email || "");
  const [schoolsCoveredFr, setSchoolsCoveredFr] = useState(profile?.schoolsCoveredFr || "");
  const [schoolsCoveredAr, setSchoolsCoveredAr] = useState(profile?.schoolsCoveredAr || "");
  const [bioFr, setBioFr] = useState(profile?.bioFr || "");
  const [bioAr, setBioAr] = useState(profile?.bioAr || "");
  const [domainsInput, setDomainsInput] = useState((profile?.interventionDomains || ["Autisme (TSA)", "Troubles DYS"]).join(", "));
  const [methodsInput, setMethodsInput] = useState((profile?.pedagogicalMethods || ["Guidance visuelle", "Renforcement"]).join(", "));

  // Action on booking
  async function updateBookingStatus(bookingId: string, status: "CONFIRMED" | "DECLINED" | "COMPLETED") {
    try {
      const res = await fetch(`/api/avs/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
        );
      }
    } catch {
      // silently handle
    }
  }

  // Save profile
  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg("");
    setProfileErrorMsg("");

    try {
      const interventionDomains = domainsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const pedagogicalMethods = methodsInput.split(",").map((s) => s.trim()).filter(Boolean);

      const res = await fetch("/api/avs/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityFr,
          cityAr,
          governorateFr,
          governorateAr,
          specialtyFr,
          specialtyAr,
          availabilityFr: availabilityFr.trim() || "Disponible immédiatement",
          availabilityAr: availabilityAr.trim() || "متاح فورًا",
          interventionDomains,
          pedagogicalMethods,
          schoolsCoveredFr,
          schoolsCoveredAr,
          hourlyRateTnd: Number(hourlyRateTnd) || 25,
          experienceYears: Number(experienceYears) || 3,
          phone,
          email,
          bioFr,
          bioAr,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur de sauvegarde");

      setProfile(data.profile);
      setProfileSuccessMsg(ar ? "تم تحديث ملفك بنجاح في الدليل الوطني." : "Votre profil a été mis à jour avec succès dans l'annuaire.");
    } catch (err: unknown) {
      setProfileErrorMsg(err instanceof Error ? err.message : "Erreur de mise à jour");
    } finally {
      setIsSavingProfile(false);
    }
  }

  const ALL_DAYS = [
    { id: 1, fr: "Lundi", ar: "الإثنين" },
    { id: 2, fr: "Mardi", ar: "الثلاثاء" },
    { id: 3, fr: "Mercredi", ar: "الأربعاء" },
    { id: 4, fr: "Jeudi", ar: "الخميس" },
    { id: 5, fr: "Vendredi", ar: "الجمعة" },
    { id: 6, fr: "Samedi", ar: "السبت" },
  ];

  function toggleWorkingDay(dayId: number) {
    setSelectedWorkingDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  }

  function toggleConsultationMode(mode: "IN_PERSON" | "ONLINE") {
    setConsultationModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mode);
      }
      return [...prev, mode];
    });
  }

  function removeSlot(slot: string) {
    setActiveSlots((prev) => prev.filter((s) => s !== slot));
  }

  function addCustomSlot() {
    const trimmed = customSlotInput.trim();
    if (!trimmed) return;
    if (!activeSlots.includes(trimmed)) {
      setActiveSlots((prev) => [...prev, trimmed].sort());
    }
    setCustomSlotInput("");
  }

  async function handleSaveCalendar(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingCalendar(true);
    setCalendarSuccessMsg("");
    setCalendarErrorMsg("");

    try {
      const dayNamesFr = selectedWorkingDays
        .map((d) => ALL_DAYS.find((item) => item.id === d)?.fr)
        .filter(Boolean)
        .join(", ");
      const dayNamesAr = selectedWorkingDays
        .map((d) => ALL_DAYS.find((item) => item.id === d)?.ar)
        .filter(Boolean)
        .join("، ");

      const modeFr =
        consultationModes.includes("IN_PERSON") && consultationModes.includes("ONLINE")
          ? "Présentiel & En ligne"
          : consultationModes.includes("IN_PERSON")
          ? "Présentiel uniquement"
          : "En ligne uniquement";

      const modeAr =
        consultationModes.includes("IN_PERSON") && consultationModes.includes("ONLINE")
          ? "حضوري وعن بعد"
          : consultationModes.includes("IN_PERSON")
          ? "حضوري فقط"
          : "عن بعد فقط";

      const newAvailFr = `Disponible (${dayNamesFr}) · ${modeFr}`;
      const newAvailAr = `متاح (${dayNamesAr}) · ${modeAr}`;

      setAvailabilityFr(newAvailFr);
      setAvailabilityAr(newAvailAr);

      const res = await fetch("/api/avs/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityFr,
          cityAr,
          governorateFr,
          governorateAr,
          specialtyFr,
          specialtyAr,
          availabilityFr: newAvailFr,
          availabilityAr: newAvailAr,
          interventionDomains: domainsInput.split(",").map((s) => s.trim()).filter(Boolean),
          pedagogicalMethods: methodsInput.split(",").map((s) => s.trim()).filter(Boolean),
          schoolsCoveredFr,
          schoolsCoveredAr,
          hourlyRateTnd: Number(hourlyRateTnd) || 25,
          experienceYears: Number(experienceYears) || 3,
          phone,
          email,
          bioFr,
          bioAr,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur de sauvegarde");

      setProfile(data.profile);
      setCalendarSuccessMsg(
        ar
          ? "تم حفظ وتحديث الأجندة والمواعيد بنجاح! تم نشر التوقيتات في الدليل العام."
          : "Votre calendrier et vos créneaux ont été enregistrés avec succès ! Disponibilités publiées dans l'annuaire."
      );
    } catch (err: unknown) {
      setCalendarErrorMsg(err instanceof Error ? err.message : "Erreur de mise à jour");
    } finally {
      setIsSavingCalendar(false);
    }
  }

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;
  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === "ALL") return true;
    return b.status === bookingFilter;
  });

  return (
    <div className="space-y-6">
      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "bookings"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="calendar" size={16} />
          <span>{ar ? "طلبات المواعيد الواردة" : "Demandes de rendez-vous"}</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-[#0056D2] text-white font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calendar")}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "calendar"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="clock" size={16} />
          <span>{ar ? "إدارة الأجندة والمواعيد المتاحة" : "Calendrier & Créneaux de RDV"}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "profile"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="user" size={16} />
          <span>{ar ? "إدارة ملفي في الدليل العام" : "Mon profil dans l'annuaire public"}</span>
        </button>
      </div>

      {/* TAB 1: Booking requests management */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{ar ? "تصفية:" : "Filtrer :"}</span>
              {[
                { key: "ALL", fr: "Toutes", ar: "الكل" },
                { key: "PENDING", fr: "En attente", ar: "قيد الانتظار" },
                { key: "CONFIRMED", fr: "Confirmées", ar: "مؤكدة" },
                { key: "DECLINED", fr: "Déclinées", ar: "ملغاة" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setBookingFilter(f.key as "ALL" | "PENDING" | "CONFIRMED" | "DECLINED")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    bookingFilter === f.key
                      ? "bg-[#0056D2] text-white border-[#0056D2]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {ar ? f.ar : f.fr}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500">
              {filteredBookings.length} {ar ? "طلب" : "demande(s)"}
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Icon name="calendar" size={32} className="text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">
                {ar ? "لا توجد طلبات مواعيد في هذا القسم." : "Aucune demande de rendez-vous pour le moment."}
              </h4>
              <p className="text-xs text-slate-500">
                {ar
                  ? "تظهر هنا طلبات الأولياء والمؤسسات عند حجز موعد من صفحة الدليل العام."
                  : "Les demandes des parents apparaîtront ici dès qu'ils planifient une rencontre."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((b) => {
                const isPending = b.status === "PENDING";
                const isConfirmed = b.status === "CONFIRMED";
                return (
                  <div
                    key={b.id}
                    className={`bg-white rounded-2xl border p-5 transition-all shadow-xs ${
                      isPending ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0056D2] font-bold flex items-center justify-center text-sm">
                          {b.parentName.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#0F172A]">{b.parentName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{b.parentPhone}</span>
                            <span>•</span>
                            <span>{b.parentEmail}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            b.status === "CONFIRMED"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.status === "DECLINED"
                              ? "bg-red-100 text-red-800"
                              : b.status === "COMPLETED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                        >
                          {b.status === "CONFIRMED"
                            ? ar ? "مؤكد" : "Confirmé"
                            : b.status === "DECLINED"
                            ? ar ? "ملغى" : "Décliné"
                            : b.status === "COMPLETED"
                            ? ar ? "مكتمل" : "Terminé"
                            : ar ? "في الانتظار" : "En attente"}
                        </span>
                      </div>
                    </div>

                    <div className="py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">{ar ? "التلميذ" : "Élève :"}</span>
                        <strong className="text-slate-800">{b.childName}</strong>
                        {b.childAge ? <span className="text-slate-500"> ({b.childAge} {ar ? "سنوات" : "ans"})</span> : null}
                        {b.schoolName ? <div className="text-slate-500">{b.schoolName}</div> : null}
                      </div>

                      <div>
                        <span className="text-slate-400 block">{ar ? "الموعد المطلوب" : "Date & Créneau :"}</span>
                        <strong className="text-slate-800">{b.requestedDate}</strong>
                        <div className="text-slate-600 flex items-center gap-1.5 mt-0.5">
                          <span>{b.requestedTimeSlot}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.meetingType === "ONLINE"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}>
                            <Icon name={b.meetingType === "ONLINE" ? "video" : "map"} size={11} />
                            <span>
                              {b.meetingType === "ONLINE"
                                ? ar ? "عن بعد" : "En ligne"
                                : b.meetingType === "HOME"
                                ? ar ? "في المنزل" : "À domicile"
                                : ar ? "حضوري" : "Sur place"}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block">{ar ? "مجال التدخل" : "Besoin :"}</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                          {b.interventionDomain || (ar ? "مرافقة عامة" : "Accompagnement")}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 mt-1">
                      <span className="font-semibold text-slate-800 block mb-0.5">{ar ? "شرح الحاجيات:" : "Motif & Besoins de l'enfant :"}</span>
                      <p className="leading-relaxed">{b.needDescription}</p>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${b.parentPhone}`}
                          className="btn btn-ghost text-xs px-3 py-1.5 flex items-center gap-1 text-emerald-800 font-semibold"
                        >
                          <Icon name="phone" size={13} />
                          <span>{ar ? "اتصال بالولي" : "Appeler le parent"}</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateBookingStatus(b.id, "CONFIRMED")}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1"
                            >
                              <Icon name="check" size={13} />
                              <span>{ar ? "تأكيد الموعد" : "Confirmer le RDV"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBookingStatus(b.id, "DECLINED")}
                              className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-semibold transition-all"
                            >
                              {ar ? "اعتذار" : "Décliner"}
                            </button>
                          </>
                        )}
                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={() => updateBookingStatus(b.id, "COMPLETED")}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                          >
                            {ar ? "تسجيل كاكتمل" : "Marquer comme honoré"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Calendar & Slot Management Console */}
      {activeTab === "calendar" && (
        <form onSubmit={handleSaveCalendar} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#0056D2]">
                {ar ? "تنظيم الأجندة والمواعيد" : "Gestion des disponibilités"}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mt-0.5">
                {ar ? "أيام وساعات العمل وصيغ المقابلات" : "Jours de travail, créneaux et modalités de rencontre"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                {ar
                  ? "حدد أيام حضورك، والساعات المتاحة لاستقبال الأولياء والتلاميذ، وصيغ اللقاء (حضوري بالمدرسة أو عن بعد). يتم تحديث هذه المواعيد تلقائياً في صفحة حجز المواعيد الخاصة بك."
                  : "Définissez vos jours de présence, vos créneaux de consultation et vos modalités d'intervention (sur place ou en ligne). Ces disponibilités sont directement synchronisées avec votre profil public de réservation."}
              </p>
            </div>
            {profile?.slug && (
              <Link
                href={`/${locale}/avs/${profile.slug}`}
                target="_blank"
                className="btn btn-ghost text-xs text-[#0056D2] font-semibold flex items-center gap-1 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                <span>{ar ? "معاينة صفحة الحجز" : "Voir mon formulaire public"}</span>
                <Icon name="arrow" size={13} className="directional-icon" />
              </Link>
            )}
          </div>

          {calendarSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Icon name="check" size={16} />
              <span>{calendarSuccessMsg}</span>
            </div>
          )}

          {calendarErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <Icon name="shield" size={16} />
              <span>{calendarErrorMsg}</span>
            </div>
          )}

          {/* 1. Working Days */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              {ar ? "1. أيام العمل الأسبوعية المتاحة للأنشطة والمواعيد" : "1. Jours de disponibilité dans la semaine"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {ALL_DAYS.map((d) => {
                const isSelected = selectedWorkingDays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleWorkingDay(d.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "border-[#0056D2] bg-[#0056D2] text-white shadow-xs font-bold"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{ar ? d.ar : d.fr}</div>
                    <div className="text-[10px] mt-1 opacity-80">
                      {isSelected ? (ar ? "متاح للعمل" : "Disponible") : (ar ? "راحة" : "Repos")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Consultation Modalities */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-800">
              {ar ? "2. صيغ اللقاء المعتمدة التي يمكن للأولياء اختيارها" : "2. Modalités acceptées pour les rencontres"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => toggleConsultationMode("IN_PERSON")}
                className={`p-4 rounded-xl border text-start flex items-start gap-3 transition-all ${
                  consultationModes.includes("IN_PERSON")
                    ? "border-[#0056D2] bg-blue-50/50 text-[#0056D2] ring-1 ring-[#0056D2]"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <div className={`p-2 rounded-lg ${consultationModes.includes("IN_PERSON") ? "bg-[#0056D2] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Icon name="map" size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {ar ? "لقاء حضوري على عين المكان" : "Rencontre en présentiel (Sur place)"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ar ? "داخل المدرسة، المركز المختص، أو مقر إقامة التلميذ" : "Dans l'établissement scolaire, le centre partenaire ou au domicile"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleConsultationMode("ONLINE")}
                className={`p-4 rounded-xl border text-start flex items-start gap-3 transition-all ${
                  consultationModes.includes("ONLINE")
                    ? "border-[#0056D2] bg-blue-50/50 text-[#0056D2] ring-1 ring-[#0056D2]"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <div className={`p-2 rounded-lg ${consultationModes.includes("ONLINE") ? "bg-[#0056D2] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Icon name="video" size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {ar ? "لقاء عن بعد (عبر الفيديو)" : "Consultation à distance (En ligne)"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ar ? "جلسة استكشاف أولية وتنسيق بيداغوجي عبر منصة آمنة" : "Échange exploratoire ou coordination pédagogique par visioconférence"}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Time Slots */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800">
                {ar ? "3. التوقيتات اليومية المتاحة للحجز (Créneaux)" : "3. Créneaux horaires de consultation"}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const morning = ["08:30 - 09:30", "09:30 - 10:30", "10:30 - 11:30", "11:30 - 12:30"];
                    setActiveSlots((prev) => Array.from(new Set([...prev, ...morning])).sort());
                  }}
                  className="text-[11px] font-semibold text-[#0056D2] hover:underline"
                >
                  {ar ? "+ فترة الصباح" : "+ Créneaux matin"}
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    const afternoon = ["14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00"];
                    setActiveSlots((prev) => Array.from(new Set([...prev, ...afternoon])).sort());
                  }}
                  className="text-[11px] font-semibold text-[#0056D2] hover:underline"
                >
                  {ar ? "+ فترة المساء" : "+ Créneaux après-midi"}
                </button>
              </div>
            </div>

            {/* Active slots pills */}
            <div className="flex flex-wrap gap-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 min-h-[58px] items-center">
              {activeSlots.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  {ar ? "لم يتم تحديد أية توقيتات بعد. أضف توقيتًا أدناه." : "Aucun créneau configuré. Ajoutez un créneau ci-dessous."}
                </span>
              ) : (
                activeSlots.map((slot) => (
                  <span
                    key={slot}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs group"
                  >
                    <Icon name="clock" size={13} className="text-[#0056D2]" />
                    <span>{slot}</span>
                    <button
                      type="button"
                      onClick={() => removeSlot(slot)}
                      className="text-slate-400 hover:text-red-600 transition-colors ml-1"
                      aria-label={ar ? `حذف ${slot}` : `Supprimer ${slot}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Custom slot input */}
            <div className="flex items-center gap-2 pt-1 max-w-sm">
              <input
                type="text"
                value={customSlotInput}
                onChange={(e) => setCustomSlotInput(e.target.value)}
                placeholder={ar ? "مثال: 12:30 - 13:30" : "Ex: 12:30 - 13:30"}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs flex-1 focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
              <button
                type="button"
                onClick={addCustomSlot}
                className="btn btn-secondary text-xs px-4 py-2 rounded-xl font-bold"
              >
                {ar ? "إضافة توقيت" : "Ajouter créneau"}
              </button>
            </div>
          </div>

          {/* 4. Live Weekly Schedule & Booked Sessions Preview */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                {ar ? "4. المعاينة المباشرة لجدول الأسبوع والمواعيد المحجوزة" : "4. Aperçu de votre semaine et réservations associées"}
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {bookings.filter((b) => b.status === "CONFIRMED").length}{" "}
                {ar ? "موعد مؤكد" : "rendez-vous confirmés"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {ALL_DAYS.filter((d) => selectedWorkingDays.includes(d.id)).map((d) => {
                return (
                  <div key={d.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-xs font-bold text-[#0F172A]">{ar ? d.ar : d.fr}</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {activeSlots.length} {ar ? "فترة" : "créneaux"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {activeSlots.slice(0, 3).map((slot) => (
                        <div key={slot} className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                          <span>{slot}</span>
                          <span className="text-[10px] text-slate-400">{ar ? "متاح" : "Libre"}</span>
                        </div>
                      ))}
                      {activeSlots.length > 3 && (
                        <div className="text-[10px] text-slate-400 text-center pt-0.5">
                          +{activeSlots.length - 3} {ar ? "توقيتات إضافية" : "autres créneaux"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {ar
                ? "يتم تطبيق التعديلات فوراً على الدليل الوطني وحساب الأولياء."
                : "Les modifications sont immédiatement répercutées sur votre profil public et le module de réservation."}
            </p>
            <button
              type="submit"
              disabled={isSavingCalendar}
              className="btn btn-primary px-7 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingCalendar ? (
                <span>{ar ? "جاري الحفظ..." : "Enregistrement..."}</span>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  <span>{ar ? "حفظ وتحديث الأجندة" : "Enregistrer les disponibilités"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Manage Public Directory Profile */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">
                {ar ? "معلومات الظهور في الدليل الوطني للمرافقين" : "Configuration de votre profil public"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {ar
                  ? "تظهر هذه المعلومات في دليل ANEI لتمكين الأولياء والمؤسسات من البحث عنك وحجز المواعيد."
                  : "Ces informations sont affichées dans l'annuaire national pour permettre aux familles de vous contacter."}
              </p>
            </div>
            {profile?.slug && (
              <Link
                href={`/${locale}/avs/${profile.slug}`}
                target="_blank"
                className="btn btn-ghost text-xs text-[#0056D2] font-semibold flex items-center gap-1"
              >
                <span>{ar ? "معاينة الصفحة العامة" : "Aperçu du profil public"}</span>
                <Icon name="arrow" size={13} className="directional-icon" />
              </Link>
            )}
          </div>

          {profileSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Icon name="check" size={16} />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <Icon name="shield" size={16} />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Location FR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "الولاية (بالفرنسية) *" : "Gouvernorat (FR) *"}
              </label>
              <input
                type="text"
                required
                value={governorateFr}
                onChange={(e) => setGovernorateFr(e.target.value)}
                placeholder="Ex: Tunis"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* Location AR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "الولاية (بالعربية) *" : "Gouvernorat (AR) *"}
              </label>
              <input
                type="text"
                required
                value={governorateAr}
                onChange={(e) => setGovernorateAr(e.target.value)}
                placeholder="مثال: تونس"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* City FR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "المدينة / المعتمدية (بالفرنسية) *" : "Ville / Zone (FR) *"}
              </label>
              <input
                type="text"
                required
                value={cityFr}
                onChange={(e) => setCityFr(e.target.value)}
                placeholder="Ex: Tunis (Centre-ville & Menzah)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* City AR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "المدينة / المعتمدية (بالعربية) *" : "Ville / Zone (AR) *"}
              </label>
              <input
                type="text"
                required
                value={cityAr}
                onChange={(e) => setCityAr(e.target.value)}
                placeholder="مثال: تونس (وسط العاصمة والمنزه)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* Specialty FR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "الاختصاص الأساسي (فرنسية) *" : "Spécialité principale (FR) *"}
              </label>
              <input
                type="text"
                required
                value={specialtyFr}
                onChange={(e) => setSpecialtyFr(e.target.value)}
                placeholder="Ex: TSA & communication adaptée"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* Specialty AR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "الاختصاص الأساسي (عربية) *" : "Spécialité principale (AR) *"}
              </label>
              <input
                type="text"
                required
                value={specialtyAr}
                onChange={(e) => setSpecialtyAr(e.target.value)}
                placeholder="مثال: طيف التوحد والتواصل المكيف"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* Availability / Disponibilité Section */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-[#F0F6FF]/70 border border-[#BFDBFE] space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0056D2]">
                  <Icon name="calendar" size={15} />
                  <span>{ar ? "أوقات التوفر وجدول العمل (Disponibilités)" : "Disponibilités & Horaires d'intervention"}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {ar
                    ? "حدد بوضوح أوقات توفرك للمرافقة لتسهيل التنسيق مع العائلات والمؤسسات التعليمية."
                    : "Indiquez votre rythme et vos plages de disponibilité pour guider les familles dans leurs demandes."}
                </p>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  {ar ? "خيارات سريعة للاختيار المباشر :" : "Suggestions rapides :"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { fr: "Disponible immédiatement (Temps plein)", ar: "متاح فورًا (دوام كامل)" },
                    { fr: "Disponible en semaine (Matinées)", ar: "متاح خلال الأسبوع (الفترة الصباحية)" },
                    { fr: "Temps partiel (Après-midis & Samedi)", ar: "دوام جزئي (بعد الظهر والسبت)" },
                    { fr: "Horaires flexibles selon planning scolaire", ar: "أوقات مرنة حسب جدول المدرسة" },
                  ].map((preset) => (
                    <button
                      key={preset.fr}
                      type="button"
                      onClick={() => {
                        setAvailabilityFr(preset.fr);
                        setAvailabilityAr(preset.ar);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg border border-amber-300 bg-white hover:bg-amber-100/70 text-slate-700 transition-colors font-medium shadow-2xs"
                    >
                      {ar ? preset.ar : preset.fr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {ar ? "صيغة التوفر (فرنسية) *" : "Disponibilité affichée (FR) *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={availabilityFr}
                    onChange={(e) => setAvailabilityFr(e.target.value)}
                    placeholder="Ex: Disponible immédiatement (Temps plein)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {ar ? "صيغة التوفر (عربية) *" : "Disponibilité affichée (AR) *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={availabilityAr}
                    onChange={(e) => setAvailabilityAr(e.target.value)}
                    placeholder="مثال: متاح فورًا (دوام كامل)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
                  />
                </div>
              </div>
            </div>

            {/* Hourly Rate & Experience */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "التعريفة بالساعة (دينار تونسي TND)" : "Tarif horaire indicatif (TND)"}
              </label>
              <input
                type="number"
                min="5"
                max="200"
                value={hourlyRateTnd}
                onChange={(e) => setHourlyRateTnd(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "سنوات الخبرة الميدانية" : "Années d'expérience"}
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            {/* Phone & Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "رقم الهاتف المهني للتواصل" : "Numéro de téléphone professionnel"}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+216 98 123 456"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "البريد الإلكتروني المهني" : "Email professionnel"}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@exemple.tn"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>
          </div>

          {/* Intervention domains */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {ar ? "مجالات التدخل (مفصولة بفاصلة)" : "Domaines d'accompagnement (séparés par des virgules)"}
            </label>
            <input
              type="text"
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
              placeholder="Autisme (TSA), Troubles DYS, TDAH, Handicap moteur"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
            />
          </div>

          {/* Pedagogical methods */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {ar ? "الأساليب والأدوات (مفصولة بفاصلة)" : "Méthodes et outils pédagogiques (séparés par des virgules)"}
            </label>
            <input
              type="text"
              value={methodsInput}
              onChange={(e) => setMethodsInput(e.target.value)}
              placeholder="PECS, TEACCH, ABA fonctionnel, Montessori adapté"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
            />
          </div>

          {/* Schools covered */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "المؤسسات المغطاة (فرنسية)" : "Établissements & écoles couverts (FR)"}
              </label>
              <input
                type="text"
                value={schoolsCoveredFr}
                onChange={(e) => setSchoolsCoveredFr(e.target.value)}
                placeholder="Ex: Écoles primaires et collèges du Grand Tunis"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "المؤسسات المغطاة (عربية)" : "Établissements & écoles couverts (AR)"}
              </label>
              <input
                type="text"
                value={schoolsCoveredAr}
                onChange={(e) => setSchoolsCoveredAr(e.target.value)}
                placeholder="مثال: المدارس الابتدائية والإعدادية بتونس الكبرى"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>
          </div>

          {/* Bio FR & AR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "السيرة المهنية والنهج (فرنسية) *" : "Bio & Démarche pédagogique (FR) *"}
              </label>
              <textarea
                rows={4}
                required
                value={bioFr}
                onChange={(e) => setBioFr(e.target.value)}
                placeholder="Décrivez votre expérience, vos formations et votre méthode de travail avec l'enfant..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {ar ? "السيرة المهنية والنهج (عربية) *" : "Bio & Démarche pédagogique (AR) *"}
              </label>
              <textarea
                rows={4}
                required
                value={bioAr}
                onChange={(e) => setBioAr(e.target.value)}
                placeholder="صف خبراتك وتكوينك وأسلوب مرافقتك للتلميذ داخل القسم..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="btn btn-primary px-8 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingProfile ? (
                <span>{ar ? "جاري الحفظ..." : "Enregistrement..."}</span>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  <span>{ar ? "حفظ وتحديث الملف العام" : "Enregistrer et publier"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
