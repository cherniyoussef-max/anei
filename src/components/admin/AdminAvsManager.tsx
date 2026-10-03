"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";
import type { AvsProfileRow, AvsBookingRequestRow } from "@/server/db/schema";

export type AdminAvsManagerProps = {
  locale: Locale;
  initialProfiles: AvsProfileRow[];
  initialBookings: Array<
    AvsBookingRequestRow & {
      avsName?: string;
      avsSpecialty?: string;
    }
  >;
};

export function AdminAvsManager({ locale, initialProfiles, initialBookings }: AdminAvsManagerProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"profiles" | "bookings">("profiles");
  const [profiles, setProfiles] = useState<AvsProfileRow[]>(initialProfiles);
  const [bookings, setBookings] = useState(initialBookings);

  // Search & Filters for Profiles
  const [searchQuery, setSearchQuery] = useState("");
  const [certifiedFilter, setCertifiedFilter] = useState<"ALL" | "YES" | "NO">("ALL");
  const [visibleFilter, setVisibleFilter] = useState<"ALL" | "YES" | "NO">("ALL");

  // Search & Filters for Bookings & Escrow
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("ALL");
  const [escrowFilter, setEscrowFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Add profile modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newCityFr, setNewCityFr] = useState("");
  const [newCityAr, setNewCityAr] = useState("");
  const [newGovFr, setNewGovFr] = useState("Tunis");
  const [newGovAr, setNewGovAr] = useState("تونس");
  const [newSpecialtyFr, setNewSpecialtyFr] = useState("");
  const [newSpecialtyAr, setNewSpecialtyAr] = useState("");
  const [newHourlyRate, setNewHourlyRate] = useState(25);
  const [newExperience, setNewExperience] = useState(3);
  const [newPhone, setNewPhone] = useState("+216 ");
  const [newCertified, setNewCertified] = useState(true);

  // Toggle certified
  async function toggleCertified(profileId: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/avs/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certified: !current }),
      });
      if (res.ok) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === profileId ? { ...p, certified: !current } : p))
        );
      }
    } catch {
      // silently handle
    }
  }

  // Toggle visible
  async function toggleVisible(profileId: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/avs/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !current }),
      });
      if (res.ok) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === profileId ? { ...p, visible: !current } : p))
        );
      }
    } catch {
      // silently handle
    }
  }

  // Delete profile
  async function deleteProfile(profileId: string) {
    if (!window.confirm(ar ? "هل أنت متأكد من حذف هذا الملف؟" : "Confirmer la suppression de ce profil AVS ?")) return;
    try {
      const res = await fetch(`/api/admin/avs/${profileId}`, { method: "DELETE" });
      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      }
    } catch {
      // silently handle
    }
  }

  // Create new profile
  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/avs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newDisplayName,
          cityFr: newCityFr,
          cityAr: newCityAr,
          governorateFr: newGovFr,
          governorateAr: newGovAr,
          specialtyFr: newSpecialtyFr,
          specialtyAr: newSpecialtyAr,
          availabilityFr: "Disponible en semaine",
          availabilityAr: "متاح خلال الأسبوع",
          hourlyRateMillimes: newHourlyRate * 1000,
          experienceYears: newExperience,
          phone: newPhone,
          certified: newCertified,
          visible: true,
          bioFr: "Professionnel qualifié en accompagnement inclusif.",
          bioAr: "مختص مؤهل في المرافقة التربوية الدامجة.",
        }),
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setProfiles((prev) => [data.profile, ...prev]);
        setIsCreateModalOpen(false);
        setNewDisplayName("");
        setNewCityFr("");
        setNewCityAr("");
        setNewSpecialtyFr("");
        setNewSpecialtyAr("");
      }
    } catch {
      // silently handle
    } finally {
      setIsSubmitting(false);
    }
  }

  // Booking & Escrow Actions
  async function handleBookingAction(
    bookingId: string,
    action: "release_escrow" | "refund" | "CONFIRMED" | "DECLINED" | "COMPLETED"
  ) {
    if (action === "release_escrow") {
      const confirmRelease = window.confirm(
        ar
          ? "هل أنت متأكد من الإفراج عن المبلغ وتحويله لحساب المرافق (AVS)؟"
          : "Confirmer la libération des fonds séquestrés vers le compte de l'AVS ?"
      );
      if (!confirmRelease) return;
    }
    if (action === "refund") {
      const confirmRefund = window.confirm(
        ar
          ? "هل أنت متأكد من استرجاع المبلغ بالكامل لحساب الولي؟"
          : "Confirmer le remboursement intégral des fonds au parent ?"
      );
      if (!confirmRefund) return;
    }

    setActionLoadingId(bookingId);
    try {
      const payload =
        action === "release_escrow" || action === "refund"
          ? { action }
          : { action: "update_status", status: action };
      const res = await fetch(`/api/admin/avs/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, ...data.booking } : b))
          );
        }
      }
    } catch (e) {
      console.error("Failed to update booking status", e);
    } finally {
      setActionLoadingId(null);
    }
  }

  // Financial Escrow Calculations
  const totalHeldMillimes = bookings
    .filter((b) => (b.paymentStatus || "HELD_IN_ESCROW") === "HELD_IN_ESCROW")
    .reduce((sum, b) => sum + (b.amountMillimes || 0), 0);

  const totalFeesMillimes = bookings
    .filter((b) => (b.paymentStatus || "HELD_IN_ESCROW") !== "REFUNDED_TO_PARENT")
    .reduce((sum, b) => sum + (b.platformFeeMillimes || 0), 0);

  const totalReleasedMillimes = bookings
    .filter((b) => b.paymentStatus === "RELEASED_TO_AVS")
    .reduce((sum, b) => sum + (b.avsPayoutMillimes || 0), 0);

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (bookingStatusFilter !== "ALL" && b.status !== bookingStatusFilter) return false;
    if (escrowFilter !== "ALL") {
      const bPayStatus = b.paymentStatus || "HELD_IN_ESCROW";
      if (bPayStatus !== escrowFilter) return false;
    }
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      const matchParent =
        b.parentName?.toLowerCase().includes(q) ||
        b.parentEmail?.toLowerCase().includes(q) ||
        b.parentPhone?.toLowerCase().includes(q);
      const matchAvs =
        b.avsName?.toLowerCase().includes(q) ||
        b.avsSpecialty?.toLowerCase().includes(q);
      const matchChild = b.childName?.toLowerCase().includes(q);
      const matchRef = b.paymentReference?.toLowerCase().includes(q);
      return matchParent || matchAvs || matchChild || matchRef;
    }
    return true;
  });

  // Filter profiles
  const filteredProfiles = profiles.filter((p) => {
    if (certifiedFilter === "YES" && !p.certified) return false;
    if (certifiedFilter === "NO" && p.certified) return false;
    if (visibleFilter === "YES" && !p.visible) return false;
    if (visibleFilter === "NO" && p.visible) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.cityFr.toLowerCase().includes(q) ||
        p.cityAr.toLowerCase().includes(q) ||
        p.specialtyFr.toLowerCase().includes(q) ||
        p.specialtyAr.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCertified = profiles.filter((p) => p.certified).length;
  const totalPendingBookings = bookings.filter((b) => b.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {ar ? "إجمالي الملفات" : "Profils AVS"}
          </div>
          <div className="text-2xl font-extrabold text-[#082D55] mt-1">{profiles.length}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {ar ? "المعتمدون ANEI" : "Certifiés ANEI"}
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{totalCertified}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {ar ? "إجمالي طلبات المواعيد" : "Demandes de rendez-vous"}
          </div>
          <div className="text-2xl font-extrabold text-[#082D55] mt-1">{bookings.length}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {ar ? "طلبات قيد المعالجة" : "En attente"}
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{totalPendingBookings}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("profiles")}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "profiles"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="award" size={16} />
          <span>{ar ? "دليل المرافقين المدرسيين (AVS)" : "Annuaire des profils AVS"}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
            {profiles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={`py-3 px-5 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "bookings"
              ? "border-[#082D55] text-[#082D55]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon name="calendar" size={16} />
          <span>{ar ? "سجل الحجوزات والمواعيد" : "Suivi des rendez-vous & réservations"}</span>
          {totalPendingBookings > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-bold">
              {totalPendingBookings}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PROFILES MANAGEMENT */}
      {activeTab === "profiles" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px]">
                <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">
                  <Icon name="search" size={16} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={ar ? "بحث بالاسم أو المدينة..." : "Rechercher par nom, ville..."}
                  className="w-full ps-9 pe-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#082D55]/20 focus:border-[#082D55]"
                />
              </div>

              <select
                value={certifiedFilter}
                onChange={(e) => setCertifiedFilter(e.target.value as "ALL" | "YES" | "NO")}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700"
              >
                <option value="ALL">{ar ? "كل شهادات الاعتماد" : "Toutes les certifications"}</option>
                <option value="YES">{ar ? "معتمد فقط" : "Certifiés uniquement"}</option>
                <option value="NO">{ar ? "غير معتمد" : "Non certifiés"}</option>
              </select>

              <select
                value={visibleFilter}
                onChange={(e) => setVisibleFilter(e.target.value as "ALL" | "YES" | "NO")}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700"
              >
                <option value="ALL">{ar ? "كل حالات الظهور" : "Toutes les visibilités"}</option>
                <option value="YES">{ar ? "ظاهر في الدليل" : "Visibles"}</option>
                <option value="NO">{ar ? "مخفي" : "Masqués"}</option>
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 font-bold"
              >
                <span>+</span>
                <span>{ar ? "إضافة مرافق جديد" : "Nouveau profil AVS"}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-start">{ar ? "المرافق" : "Accompagnant"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "الموقع" : "Localisation"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "الاختصاص" : "Spécialité"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "التعريفة" : "Tarif"}</th>
                    <th className="py-3 px-4 text-center">{ar ? "اعتماد ANEI" : "Certification"}</th>
                    <th className="py-3 px-4 text-center">{ar ? "الظهور" : "Visibilité"}</th>
                    <th className="py-3 px-4 text-end">{ar ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfiles.map((p) => {
                    const rateTnd = p.hourlyRateMillimes > 0 ? Math.round(p.hourlyRateMillimes / 1000) : 25;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#082D55]">{p.displayName}</div>
                          <div className="text-[11px] text-slate-400">{p.phone || p.email || "—"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{ar ? p.cityAr : p.cityFr}</div>
                          <div className="text-[11px] text-slate-400">{ar ? p.governorateAr : p.governorateFr}</div>
                        </td>
                        <td className="py-3 px-4 max-w-[200px] truncate text-slate-700">
                          {ar ? p.specialtyAr : p.specialtyFr}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {rateTnd} TND/h
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCertified(p.id, p.certified)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                              p.certified
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {p.certified ? (ar ? "معتمد" : "Certifié") : (ar ? "غير معتمد" : "Standard")}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleVisible(p.id, p.visible)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                              p.visible
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {p.visible ? (ar ? "ظاهر" : "Visible") : (ar ? "مخفي" : "Masqué")}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-end">
                          <div className="flex items-center justify-end gap-2">
                            {p.slug && (
                              <Link
                                href={`/${locale}/avs/${p.slug}`}
                                target="_blank"
                                className="p-1 rounded text-slate-500 hover:text-[#082D55]"
                                title={ar ? "معاينة الملف" : "Voir la page"}
                              >
                                <Icon name="link" size={14} />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteProfile(p.id)}
                              className="p-1 rounded text-red-400 hover:text-red-700"
                              title={ar ? "حذف" : "Supprimer"}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL BOOKINGS & ESCROW MONITORING */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Escrow Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {ar ? "إجمالي الحجوزات" : "Réservations totales"}
              </div>
              <div className="text-2xl font-extrabold text-[#082D55] mt-1">
                {bookings.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {ar ? "كافة مواعيد الأولياء والمرافقين" : "Total des rendez-vous enregistrés"}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="shield" size={14} className="text-emerald-600" />
                <span>{ar ? "أموال تحت حراسة ANEI" : "Fonds sous Séquestre ANEI"}</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                {(totalHeldMillimes / 1000).toFixed(3)} <span className="text-sm font-semibold">TND</span>
              </div>
              <div className="text-[11px] text-emerald-700/80 mt-1">
                {ar ? "مؤمّنة كطرف ثالث حتى تأكيد الحصة" : "Garantis par ANEI jusqu'à la tenue de la séance"}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-2xs">
              <div className="text-xs font-bold text-[#082D55] uppercase tracking-wider">
                {ar ? "عمولات المنصة (10%)" : "Commissions ANEI (10%)"}
              </div>
              <div className="text-2xl font-extrabold text-[#082D55] mt-1">
                {(totalFeesMillimes / 1000).toFixed(3)} <span className="text-sm font-semibold">TND</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {ar ? "أتعاب الوساطة والإشراف القانوني" : "Frais de tiers de confiance & supervision"}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {ar ? "أموال محوّلة للمرافقين" : "Fonds versés aux AVS"}
              </div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-1">
                {(totalReleasedMillimes / 1000).toFixed(3)} <span className="text-sm font-semibold">TND</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {ar ? "مبالغ تم تحويلها بعد انتهاء الحصة" : "Montants réglés après réalisation de séance"}
              </div>
            </div>
          </div>

          {/* Bookings Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px]">
                <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">
                  <Icon name="search" size={16} />
                </span>
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder={ar ? "بحث بالولي، المرافق، الطفل، أو المرجع..." : "Rechercher par parent, AVS, élève, réf séquestre..."}
                  className="w-full ps-9 pe-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#082D55]/20 focus:border-[#082D55]"
                />
              </div>

              {/* Escrow Status Filter */}
              <select
                value={escrowFilter}
                onChange={(e) => setEscrowFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">{ar ? "كل الحالات المالية" : "Tous les statuts financiers"}</option>
                <option value="HELD_IN_ESCROW">{ar ? "🛡️ أموال تحت الحراسة (Escrow)" : "🛡️ Fonds sous séquestre"}</option>
                <option value="RELEASED_TO_AVS">{ar ? "✓ محوّلة للمرافق (Débloqués)" : "✓ Versés à l'AVS"}</option>
                <option value="REFUNDED_TO_PARENT">{ar ? "↩ مسترجعة للولي (Remboursés)" : "↩ Remboursés au parent"}</option>
              </select>

              {/* RDV Status Filter */}
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
              >
                <option value="ALL">{ar ? "كل حالات المواعيد" : "Tous les états de RDV"}</option>
                <option value="PENDING">{ar ? "قيد الانتظار (En attente)" : "En attente (PENDING)"}</option>
                <option value="CONFIRMED">{ar ? "مؤكد (Confirmé)" : "Confirmé (CONFIRMED)"}</option>
                <option value="COMPLETED">{ar ? "مكتمل (Terminé)" : "Terminé (COMPLETED)"}</option>
                <option value="DECLINED">{ar ? "ملغى / مرفوض (Refusé)" : "Refusé / Annulé (DECLINED)"}</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              {filteredBookings.length} {ar ? "موعد معروض" : "rendez-vous affichés"}
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-start">{ar ? "الضمان المالي (Séquestre ANEI)" : "Séquestre & Paiement"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "المرافق" : "Accompagnant (AVS)"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "ولي الأمر" : "Parent / Contact"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "التلميذ والحاجة" : "Élève & Besoin"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "الموعد المطلوب" : "Date & Créneau"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "حالة الموعد" : "Statut RDV"}</th>
                    <th className="py-3 px-4 text-start">{ar ? "إجراءات الحراسة المالية" : "Gestion Séquestre"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        {ar ? "لا توجد حجوزات تطابق البحث." : "Aucune réservation ne correspond à vos filtres."}
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => {
                      const payStatus = b.paymentStatus || "HELD_IN_ESCROW";
                      const isHeld = payStatus === "HELD_IN_ESCROW";
                      const isReleased = payStatus === "RELEASED_TO_AVS";
                      const isRefunded = payStatus === "REFUNDED_TO_PARENT";
                      const isLoading = actionLoadingId === b.id;

                      const amountTnd = b.amountMillimes ? (b.amountMillimes / 1000).toFixed(3) : "38.500";
                      const feeTnd = b.platformFeeMillimes ? (b.platformFeeMillimes / 1000).toFixed(3) : "3.500";
                      const payoutTnd = b.avsPayoutMillimes ? (b.avsPayoutMillimes / 1000).toFixed(3) : "35.000";

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* ESCROW PAYMENT DETAILS */}
                          <td className="py-3 px-4">
                            <div className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                              {b.paymentReference || `ESC-${b.id.slice(0, 8).toUpperCase()}`}
                            </div>
                            <div className="mt-1 font-bold text-slate-900 text-sm">
                              {amountTnd} <span className="text-[11px] font-normal text-slate-500">TND</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {ar ? `عمولة ANEI: ${feeTnd} د.ت` : `Frais ANEI: ${feeTnd} TND`}
                            </div>
                            <div className="mt-1.5">
                              {isHeld && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Icon name="shield" size={11} className="text-emerald-700" />
                                  <span>{ar ? "تحت الحراسة" : "Fonds sous séquestre"}</span>
                                </span>
                              )}
                              {isReleased && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Icon name="check" size={11} className="text-blue-700" />
                                  <span>{ar ? `تم التحويل (${payoutTnd} د.ت)` : `Versé à l'AVS (${payoutTnd} TND)`}</span>
                                </span>
                              )}
                              {isRefunded && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <span>{ar ? "تم الاسترجاع للولي" : "Remboursé au parent"}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* AVS INFO */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#082D55] text-sm">
                              {b.avsName || b.avsProfileId.slice(0, 8)}
                            </div>
                            <div className="text-[11px] text-[#a9752f] font-semibold">
                              {b.avsSpecialty || (ar ? "مرافق مدرسي" : "Accompagnant")}
                            </div>
                          </td>

                          {/* PARENT CONTACT */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{b.parentName}</div>
                            <div className="text-[11px] text-slate-600 font-mono">{b.parentPhone}</div>
                            <div className="text-[11px] text-slate-400">{b.parentEmail}</div>
                          </td>

                          {/* CHILD & NEED */}
                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="font-semibold text-slate-900">{b.childName}</div>
                            <div className="text-[11px] text-slate-500">
                              {b.childAge ? `${b.childAge} ans` : ""} {b.schoolName ? `• ${b.schoolName}` : ""}
                            </div>
                            {b.interventionDomain && (
                              <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold mt-1">
                                {b.interventionDomain}
                              </span>
                            )}
                            {b.needDescription && (
                              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2" title={b.needDescription}>
                                {b.needDescription}
                              </p>
                            )}
                          </td>

                          {/* REQUESTED DATE & FORMAT */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{b.requestedDate}</div>
                            <div className="text-[11px] text-slate-500">{b.requestedTimeSlot}</div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                              {b.meetingType || "Cabinet"}
                            </span>
                          </td>

                          {/* BOOKING STATUS */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block ${
                                b.status === "CONFIRMED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : b.status === "DECLINED"
                                  ? "bg-rose-100 text-rose-800"
                                  : b.status === "COMPLETED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-900 border border-amber-300"
                              }`}
                            >
                              {b.status === "PENDING"
                                ? ar ? "قيد الانتظار" : "En attente"
                                : b.status === "CONFIRMED"
                                ? ar ? "مؤكد" : "Confirmé"
                                : b.status === "COMPLETED"
                                ? ar ? "مكتمل" : "Terminé"
                                : ar ? "ملغى / مرفوض" : "Refusé"}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1.5 min-w-[140px]">
                              {isHeld && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleBookingAction(b.id, "release_escrow")}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                                    title={ar ? "تحويل مستحقات المرافق وإنهاء الحجز" : "Libérer les fonds séquestrés vers l'AVS"}
                                  >
                                    <Icon name="check" size={12} />
                                    <span>{ar ? "صرف للمرافق" : "Débloquer AVS"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleBookingAction(b.id, "refund")}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 transition flex items-center justify-center gap-1 disabled:opacity-50"
                                    title={ar ? "إرجاع كامل المبلغ لحساب الولي" : "Rembourser intégralement le parent"}
                                  >
                                    <span>{ar ? "استرجاع للولي" : "Rembourser"}</span>
                                  </button>
                                </>
                              )}

                              {b.status === "PENDING" && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleBookingAction(b.id, "CONFIRMED")}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-center disabled:opacity-50"
                                >
                                  {ar ? "تأكيد الموعد" : "Confirmer le RDV"}
                                </button>
                              )}

                              {b.status !== "DECLINED" && !isRefunded && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleBookingAction(b.id, "DECLINED")}
                                  className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-rose-600 text-center transition"
                                >
                                  {ar ? "إلغاء الموعد" : "Annuler le RDV"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-[#082D55]">
                {ar ? "إضافة ملف مرافق مدرسي جديد" : "Créer un nouveau profil AVS"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {ar ? "الاسم واللقب *" : "Nom complet *"}
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Ex: Salma Karray"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#082D55]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gouvernorat (FR)</label>
                  <input
                    type="text"
                    required
                    value={newGovFr}
                    onChange={(e) => setNewGovFr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الولاية (AR)</label>
                  <input
                    type="text"
                    required
                    value={newGovAr}
                    onChange={(e) => setNewGovAr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ville / Zone (FR) *</label>
                  <input
                    type="text"
                    required
                    value={newCityFr}
                    onChange={(e) => setNewCityFr(e.target.value)}
                    placeholder="Tunis (Menzah)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المدينة / المنطقة (AR) *</label>
                  <input
                    type="text"
                    required
                    value={newCityAr}
                    onChange={(e) => setNewCityAr(e.target.value)}
                    placeholder="تونس (المنزه)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Spécialité (FR) *</label>
                  <input
                    type="text"
                    required
                    value={newSpecialtyFr}
                    onChange={(e) => setNewSpecialtyFr(e.target.value)}
                    placeholder="TSA & communication"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الاختصاص (AR) *</label>
                  <input
                    type="text"
                    required
                    value={newSpecialtyAr}
                    onChange={(e) => setNewSpecialtyAr(e.target.value)}
                    placeholder="طيف التوحد والتواصل"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tarif TND/h</label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={newHourlyRate}
                    onChange={(e) => setNewHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expérience (ans)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={newExperience}
                    onChange={(e) => setNewExperience(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="newCertified"
                  checked={newCertified}
                  onChange={(e) => setNewCertified(e.target.checked)}
                  className="rounded text-[#082D55]"
                />
                <label htmlFor="newCertified" className="font-semibold text-slate-700 cursor-pointer">
                  {ar ? "منح اعتماد ANEI فورًا" : "Accorder immédiatement la certification ANEI"}
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-ghost text-xs"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary text-xs px-5 py-2 font-bold"
                >
                  {isSubmitting ? "Enregistrement..." : ar ? "إضافة ونشر" : "Créer le profil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
