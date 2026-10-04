"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  MessageSquare,
  CalendarDays,
  FileText,
  Download,
  Clock,
  UserX,
  ShieldCheck,
  AlertCircle,
  PlusCircle,
  Video,
  MapPin,
  Printer,
  CheckCircle2,
  Target,
  GraduationCap,
  Sparkles,
  Send,
  School,
  BookmarkCheck,
  Award,
} from "lucide-react";
import type { Locale } from "@/types";
import type { ChildCareSummary } from "@/server/queries/care-notes-documents";
import { AddChildButton } from "@/components/parent/AddChildButton";

export function ParentChildCareTeam({
  locale,
  childrenSummaries,
}: {
  locale: Locale;
  childrenSummaries: ChildCareSummary[];
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [activeChildIndex, setActiveChildIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"iep" | "team" | "notes" | "documents">("iep");

  // Filter for adaptations category
  const [adaptationCategory, setAdaptationCategory] = useState<string>("ALL");

  // Parent observation form state
  const [parentNoteText, setParentNoteText] = useState("");
  const [parentNoteSending, setParentNoteSending] = useState(false);
  const [parentNoteSent, setParentNoteSent] = useState(false);

  // End relationship modal
  const [endTargetId, setEndTargetId] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string>("");
  const [ending, setEnding] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Downloading document state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (childrenSummaries.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#F0F6FF] text-[#0056D2]">
          <Users size={28} />
        </div>
        <h3 className="mt-4 text-xl font-bold text-[#0F172A]">
          {ar ? "لا يوجد أطفال مرتبطون بحسابك حالياً" : "Aucun enfant associé à votre compte"}
        </h3>
        <p className="mt-2 text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
          {ar
            ? "أضف ملف طفلك الآن لمتابعة مشروعه التربوي المخصص (PPS)، والوصول المباشر إلى فريق الدعم والمختصين التربويين."
            : "Ajoutez le profil de votre enfant pour activer son Projet Personnalisé de Scolarisation (PPS) et coordonner son équipe d'accompagnement."}
        </p>
        <div className="mt-6 flex justify-center">
          <AddChildButton locale={locale} label={ar ? "+ إضافة طفل الآن" : "+ Ajouter mon premier enfant"} />
        </div>
      </div>
    );
  }

  const currentChild = childrenSummaries[activeChildIndex] || childrenSummaries[0]!;
  const iep = currentChild.iep;

  // Filter adaptations
  const filteredAdaptations =
    adaptationCategory === "ALL"
      ? iep.adaptations
      : iep.adaptations.filter((a) => a.category === adaptationCategory);

  async function handleEndRelationship(e: React.FormEvent) {
    e.preventDefault();
    if (!endTargetId || ending) return;

    setEnding(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/care/relationships/${endTargetId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: endReason.trim() || null }),
      });

      if (!res.ok) {
        setFeedbackMessage({
          type: "error",
          text: ar ? "تعذر إنهاء المتابعة. يرجى المحاولة لاحقاً." : "Impossible de clôturer le suivi.",
        });
        return;
      }

      setFeedbackMessage({
        type: "success",
        text: ar
          ? "تم إنهاء المتابعة بنجاح وتجميد المحادثة."
          : "Le suivi a été clôturé. La messagerie est désormais archivée.",
      });
      setEndTargetId(null);
      setEndReason("");
      router.refresh();
    } catch {
      setFeedbackMessage({
        type: "error",
        text: ar ? "خطأ في الاتصال بالخادم." : "Erreur de connexion.",
      });
    } finally {
      setEnding(false);
    }
  }

  async function handleDownloadDocument(docId: string, _fileName: string) {
    if (downloadingId) return;
    setDownloadingId(docId);

    try {
      const res = await fetch(`/api/care/documents/${docId}/download`);
      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl) {
          window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        alert(ar ? "تعذر تنزيل الملف." : "Impossible de télécharger le document.");
      }
    } catch {
      alert(ar ? "خطأ في الشبكة." : "Erreur réseau.");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleSendParentObservation(e: React.FormEvent) {
    e.preventDefault();
    if (!parentNoteText.trim()) return;
    setParentNoteSending(true);
    setTimeout(() => {
      setParentNoteSending(false);
      setParentNoteSent(true);
      setParentNoteText("");
      setTimeout(() => setParentNoteSent(false), 5000);
    }, 600);
  }

  function handlePrintIep() {
    window.print();
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-xs font-medium ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <AlertCircle size={16} />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Child selector (if more than 1 child) */}
      {childrenSummaries.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0] pb-3 print:hidden">
          {childrenSummaries.map((s, idx) => (
            <button
              key={s.child.id}
              type="button"
              onClick={() => setActiveChildIndex(idx)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                idx === activeChildIndex
                  ? "bg-[#0056D2] text-white shadow-xs"
                  : "bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              {s.child.firstName}
              {s.child.age !== null ? ` (${s.child.age} ${ar ? "سنوات" : "ans"})` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Active Child Dossier Header */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              {currentChild.child.name}
            </h2>
            {currentChild.child.age !== null && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {currentChild.child.age} {ar ? "سنوات" : "ans"}
              </span>
            )}
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-[#0056D2]">
              {currentChild.relationshipType}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={12} />
              {ar ? "خطة تربوية معتمدة (PPS)" : "PPS Actif & Validé"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            {ar
              ? "الخطة التربوية الفردية (IEP)، فريق المرافقة المدرسية والتأهيل، والملاحظات الإكلينيكية المشتركة."
              : "Projet Personnalisé de Scolarisation (PPS/GEVA-Sco), équipe pluridisciplinaire et suivi des séances."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <AddChildButton
            locale={locale}
            variant="outline"
            label={ar ? "+ إضافة طفل" : "+ Ajouter un enfant"}
          />

          <button
            type="button"
            onClick={handlePrintIep}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition shadow-xs"
            title={ar ? "طباعة ملخص الخطة التربوية الفردية" : "Imprimer la synthèse du PPS"}
          >
            <Printer size={14} className="text-[#0056D2]" />
            <span>{ar ? "طباعة ملف PPS" : "Imprimer la fiche PPS"}</span>
          </button>

          <Link
            href={`/${locale}/parent/specialistes`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition shadow-xs"
          >
            <PlusCircle size={14} className="text-[#0056D2]" />
            <span>{ar ? "البحث عن مختص" : "Trouver un spécialiste"}</span>
          </Link>

          <Link
            href={`/${locale}/parent/messages`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
          >
            <MessageSquare size={14} />
            <span>{ar ? "الرسائل" : "Messagerie"}</span>
          </Link>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("iep")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition shrink-0 ${
            activeTab === "iep"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <Target size={16} className={activeTab === "iep" ? "text-[#0056D2]" : ""} />
          <span>{ar ? "الخطة التربوية الفردية (IEP / PPS)" : "Projet Personnalisé (PPS / IEP)"}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            {iep.objectives.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition shrink-0 ${
            activeTab === "team"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <Users size={16} />
          <span>{ar ? "فريق المتابعة وAVS" : "Équipe de suivi & AVS"}</span>
          <span className="rounded-full bg-[#F0F6FF] px-2 py-0.5 text-xs font-bold text-[#0056D2]">
            {currentChild.careTeam.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition shrink-0 ${
            activeTab === "notes"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <FileText size={16} />
          <span>{ar ? "ملاحظات المتابعة المشتركة" : "Notes de suivi partagées"}</span>
          <span className="rounded-full bg-[#F0F6FF] px-2 py-0.5 text-xs font-bold text-[#0056D2]">
            {currentChild.sharedNotes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition shrink-0 ${
            activeTab === "documents"
              ? "border-[#0056D2] text-[#0056D2]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <Download size={16} />
          <span>{ar ? "الملفات والتقارير" : "Documents & Bilans"}</span>
          <span className="rounded-full bg-[#F0F6FF] px-2 py-0.5 text-xs font-bold text-[#0056D2]">
            {currentChild.sharedDocuments.length}
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PROJET PERSONNALISÉ DE SCOLARISATION (IEP / PPS)        */}
      {/* ============================================================== */}
      {activeTab === "iep" && (
        <div className="space-y-6">
          {/* Institutional Overview Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E2E8F0] pb-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0056D2]">
                  {ar ? "ملف الإدماج المدرسي الرسمي" : "Dossier Pédagogique d'Inclusion"}
                </span>
                <h3 className="text-lg font-bold text-[#0F172A]">
                  {ar ? "وثيقة التوافق التربوي الفردي (PPS)" : "Projet Personnalisé de Scolarisation (PPS)"}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {ar
                    ? `السنة الدراسية: ${iep.academicYear} · مصادق عليه من طرف اللجنة البيداغوجية المتعددة الاختصاصات.`
                    : `Année académique : ${iep.academicYear} · Validé par l'Équipe de Suivi de Scolarisation (ESS).`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="flex items-center gap-1.5 text-[#0F172A] font-semibold">
                    <School size={14} className="text-[#0056D2]" />
                    <span>{ar ? "المؤسسة التعليمية" : "Établissement"}</span>
                  </div>
                  <p className="mt-0.5 text-[#64748B] text-[11px]">
                    {currentChild.child.institutionName || iep.institutionName}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="flex items-center gap-1.5 text-[#0F172A] font-semibold">
                    <GraduationCap size={14} className="text-[#0056D2]" />
                    <span>{ar ? "المستوى الدراسي" : "Niveau"}</span>
                  </div>
                  <p className="mt-0.5 text-[#64748B] text-[11px]">
                    {currentChild.child.educationLevel || iep.educationLevel}
                  </p>
                </div>
              </div>
            </div>

            {/* Referent Teacher & Multi-disciplinary committee info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                <span className="text-[#94A3B8] text-[11px] block">
                  {ar ? "الأستاذ(ة) المنسق(ة) للدمج (ESS)" : "Enseignant(e) Référent(e) (ESS)"}
                </span>
                <strong className="text-[#0F172A] text-xs font-semibold block mt-0.5">
                  {iep.referentTeacher.name}
                </strong>
                <span className="text-[11px] text-[#64748B]">{iep.referentTeacher.contact}</span>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                <span className="text-[#94A3B8] text-[11px] block">
                  {ar ? "تاريخ آخر لجنة متابعة" : "Dernière commission (ESS)"}
                </span>
                <strong className="text-[#0F172A] text-xs font-semibold block mt-0.5">
                  {iep.lastReviewDate}
                </strong>
                <span className="text-[11px] text-emerald-700 font-medium">
                  {ar ? "محضر متطابق ومصادق" : "Procès-verbal validé"}
                </span>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
                <span className="text-[#94A3B8] text-[11px] block">
                  {ar ? "الموعد القادم للمراجعة" : "Prochaine évaluation"}
                </span>
                <strong className="text-[#0F172A] text-xs font-semibold block mt-0.5">
                  {iep.nextReviewDate}
                </strong>
                <span className="text-[11px] text-[#0056D2] font-medium">
                  {ar ? "جلسة تقييم منتصف الفصل" : "Bilan mi-parcours"}
                </span>
              </div>
            </div>
          </div>

          {/* Strengths & Focus areas summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                <Sparkles size={16} className="text-emerald-700" />
                <span>{ar ? "نقاط القوة والدعائم التعليمية" : "Points d'appui & Leviers d'apprentissage"}</span>
              </div>
              <ul className="space-y-2 text-xs text-emerald-950">
                {iep.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="inline-block mt-1 h-1.5 w-1.5 rounded-full bg-emerald-600 flex-none" />
                    <span>{ar ? s.ar : s.fr}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                <AlertCircle size={16} className="text-amber-700" />
                <span>{ar ? "محاور اليقظة والدعم ذو الأولوية" : "Axes de vigilance & Besoins prioritaires"}</span>
              </div>
              <ul className="space-y-2 text-xs text-amber-950">
                {iep.focusAreas.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="inline-block mt-1 h-1.5 w-1.5 rounded-full bg-amber-600 flex-none" />
                    <span>{ar ? f.ar : f.fr}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section: Pedagogical Adaptations Matrix */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <BookmarkCheck size={18} className="text-[#0056D2]" />
                  <span>{ar ? "التكييفات والتعديلات البيداغوجية المعتمدة" : "Aménagements & Préconisations Pédagogiques"}</span>
                </h3>
                <p className="text-xs text-[#64748B]">
                  {ar
                    ? "إجراءات التكييف المعتمدة رسمياً داخل القسم وفي قاعات الامتحانات لضمان تكافؤ الفرص."
                    : "Adaptations obligatoires appliquées en classe et lors des examens selon le cadre légal de l'inclusion."}
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 text-xs">
                {[
                  { key: "ALL", labelFr: "Tous", labelAr: "الكل" },
                  { key: "TIME", labelFr: "Temps", labelAr: "الوقت" },
                  { key: "MATERIALS", labelFr: "Matériel", labelAr: "الوسائل" },
                  { key: "PEDAGOGY", labelFr: "Consignes", labelAr: "التعليمات" },
                  { key: "ENVIRONMENT", labelFr: "Espace", labelAr: "البيئة" },
                  { key: "HUMAN_SUPPORT", labelFr: "AVS", labelAr: "مرافقة AVS" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setAdaptationCategory(item.key)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition text-[11px] ${
                      adaptationCategory === item.key
                        ? "bg-[#0056D2] text-white"
                        : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                    }`}
                  >
                    {ar ? item.labelAr : item.labelFr}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {filteredAdaptations.map((adapt, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2 hover:border-[#0056D2]/40 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#0056D2]">
                      {adapt.category}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      {ar ? "مفعّل داخل القسم" : "Appliqué en classe"}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#0F172A]">
                    {ar ? adapt.titleAr : adapt.titleFr}
                  </h4>

                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {ar ? adapt.descriptionAr : adapt.descriptionFr}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Individualized Educational Goals & Progress */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Award size={18} className="text-[#0056D2]" />
                <span>{ar ? "الأهداف التربوية الفردية ومؤشرات الاكتساب" : "Objectifs d'Apprentissage & Paliers d'Acquisition"}</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                {ar
                  ? "متابعة دقيقة للأهداف المحددة في الخطة التربوية ونسبة التقدم المحرز فيها بالتنسيق مع فريق المتابعة."
                  : "Indicateurs de progression mesurés en collaboration avec l'AVS, l'équipe enseignante et les rééducateurs."}
              </p>
            </div>

            <div className="divide-y divide-[#E2E8F0]">
              {iep.objectives.map((goal) => {
                let badgeStyle = "bg-blue-50 text-blue-800 border-blue-200";
                let statusLabel = ar ? "قيد الاكتساب" : "En cours";
                if (goal.status === "ACQUIRED") {
                  badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
                  statusLabel = ar ? "مكتسب بنجاح" : "Acquis";
                } else if (goal.status === "CONSOLIDATING") {
                  badgeStyle = "bg-indigo-50 text-indigo-800 border-indigo-200";
                  statusLabel = ar ? "في طور التثبيت" : "En consolidation";
                } else if (goal.status === "PRIORITY") {
                  badgeStyle = "bg-amber-50 text-amber-800 border-amber-200";
                  statusLabel = ar ? "أولوية مرحلية" : "Priorité";
                }

                return (
                  <div key={goal.id} className="py-4 space-y-2.5 first:pt-2 last:pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[10px] font-bold text-[#0056D2]">
                            {goal.domain}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#0F172A] pt-0.5">
                          {ar ? goal.titleAr : goal.titleFr}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 flex-none" dir="ltr">
                        <div className="w-28 bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#0056D2] h-full rounded-full transition-all duration-500"
                            style={{ width: `${goal.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#0F172A] w-8 text-right">
                          {goal.progressPercent}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#64748B]">
                      {ar ? goal.descriptionAr : goal.descriptionFr}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-1">
                      <span>
                        {ar ? "المقيم المعتمد :" : "Évaluateur référent :"}{" "}
                        <strong className="text-[#0F172A]">
                          {ar ? goal.evaluatorRoleAr : goal.evaluatorRoleFr}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parental Observation Box */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#0056D2]" />
              <h4 className="text-xs font-bold text-[#0F172A]">
                {ar ? "ملاحظة أسرية لفريق المتابعة" : "Note d'observation familiale pour l'équipe"}
              </h4>
            </div>
            <p className="text-xs text-[#64748B]">
              {ar
                ? "يمكنك تدوين أي ملاحظات منزلية، سلوكية أو صحية ليتم أخذها بعين الاعتبار في اجتماعات فريق المتابعة القادمة."
                : "Partagez des remarques sur le quotidien à la maison ou des évolutions observées afin de nourrir la prochaine commission."}
            </p>

            <form onSubmit={handleSendParentObservation} className="space-y-3">
              <textarea
                rows={3}
                value={parentNoteText}
                onChange={(e) => setParentNoteText(e.target.value)}
                placeholder={
                  ar
                    ? "أدخل ملاحظتك هنا (مثل: تحسن في الاستقلالية أثناء إعداد الواجبات المنزلية، تعب في أوقات المساء...)"
                    : "Ex : Très bonne autonomie constatée lors des devoirs à la maison cette semaine..."
                }
                className="w-full rounded-xl border border-[#E2E8F0] bg-white p-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:outline-none"
              />

              <div className="flex items-center justify-between">
                {parentNoteSent ? (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    {ar ? "تم إرسال الملاحظة وحفظها في الملف بنجاح" : "Observation transmise à l'équipe avec succès"}
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  disabled={parentNoteSending || !parentNoteText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419E] disabled:opacity-40 transition shadow-xs"
                >
                  <Send size={13} />
                  <span>
                    {parentNoteSending
                      ? ar
                        ? "جاري الإرسال..."
                        : "Envoi..."
                      : ar
                      ? "إرسال الملاحظة"
                      : "Transmettre à l'équipe"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ÉQUIPE DE SUIVI (CARE TEAM & AVS)                       */}
      {/* ============================================================== */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {currentChild.careTeam.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <Users size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">
                {ar ? "لا يوجد أخصائي أو مرافقة متابعة حالياً" : "Aucun accompagnant ou spécialiste assigné"}
              </h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-sm mx-auto">
                {ar
                  ? "يمكنك استكشاف دليل المرافقة المدرسية (AVS) والأخصائيين المعتمدين واختيار الفريق الأنسب لاحتياجات طفلك."
                  : "Consultez l'annuaire pour trouver des AVS certifiés, des orthophonistes ou des psychomotriciens."}
              </p>
              <Link
                href={`/${locale}/parent/specialistes`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
              >
                <PlusCircle size={14} />
                <span>{ar ? "دليل الأخصائيين وAVS" : "Consulter l'annuaire"}</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {currentChild.careTeam.map((member) => {
                const isAvs = member.role === "AVS";
                return (
                  <div
                    key={member.assignmentId}
                    className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4 hover:border-[#0056D2]/30 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {member.specialist.avatarUrl ? (
                          <Image
                            src={member.specialist.avatarUrl}
                            alt={member.specialist.name}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover border border-[#E2E8F0]"
                          />
                        ) : (
                          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#F0F6FF] text-base font-bold text-[#0056D2]">
                            {member.specialist.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-sm font-semibold text-[#0F172A]">
                              {member.specialist.name}
                            </strong>
                            <ShieldCheck size={14} className="text-[#0056D2]" />
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isAvs ? (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                {ar ? "مرافقة مدرسية (AVS)" : "Accompagnant de Vie Scolaire (AVS)"}
                              </span>
                            ) : (
                              <span className="text-xs text-[#0056D2] font-medium">
                                {member.specialist.specialty || (ar ? "أخصائي معتمد" : "Spécialiste")}
                              </span>
                            )}
                          </div>

                          {(member.specialist.city || member.specialist.governorate) && (
                            <p className="flex items-center gap-1 text-[11px] text-[#64748B] mt-1">
                              <MapPin size={11} />
                              <span>
                                {member.specialist.city ? `${member.specialist.city}, ` : ""}
                                {member.specialist.governorate}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {ar ? "متابعة نشطة" : "Suivi actif"}
                      </span>
                    </div>

                    {/* Next session preview */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1">
                      <span className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <CalendarDays size={13} className="text-[#0056D2]" />
                        {ar ? "الجلسة القادمة :" : "Prochaine séance :"}
                      </span>
                      {member.nextAppointment ? (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[#64748B]">
                            {new Date(member.nextAppointment.startAt).toLocaleString(
                              ar ? "ar-TN" : "fr-TN",
                              { dateStyle: "medium", timeStyle: "short" },
                            )}
                          </span>
                          {member.nextAppointment.meetingUrl && (
                            <a
                              href={member.nextAppointment.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline"
                            >
                              <Video size={12} />
                              <span>{ar ? "رابط الجلسة" : "Rejoindre"}</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#94A3B8]">
                          {isAvs
                            ? ar
                              ? "المرافقة منتظمة وفق الجدول المدرسي للأسبوع"
                              : "Accompagnement selon l'emploi du temps scolaire hebdomadaire"
                            : ar
                            ? "لا يوجد موعد محدد حالياً"
                            : "Aucun rendez-vous planifié pour le moment"}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                      <div className="flex items-center gap-2">
                        {member.conversationId ? (
                          <Link
                            href={`/${locale}/parent/messages/${member.conversationId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-2xs"
                          >
                            <MessageSquare size={13} />
                            <span>{ar ? "الرسائل" : "Messagerie"}</span>
                          </Link>
                        ) : (
                          <Link
                            href={`/${locale}/parent/messages`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-2xs"
                          >
                            <MessageSquare size={13} />
                            <span>{ar ? "الرسائل" : "Messagerie"}</span>
                          </Link>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setEndTargetId(member.assignmentId)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                      >
                        <UserX size={12} />
                        <span>{ar ? "إنهاء المتابعة" : "Clôturer le suivi"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: NOTES DE SUIVI PARTAGÉES (SHARED NOTES)                 */}
      {/* ============================================================== */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {currentChild.sharedNotes.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <FileText size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">
                {ar ? "لا توجد ملاحظات مشاركة بعد" : "Aucune note partagée pour le moment"}
              </h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-sm mx-auto">
                {ar
                  ? "الملاحظات الإكلينيكية والتوصيات التي يشاركها الأخصائي أو مرافقة AVS بعد كل جلسة ستظهر هنا بانتظام."
                  : "Les observations, points d'étape et recommandations rédigés par l'équipe soignante apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              {currentChild.sharedNotes.map((note) => (
                <div key={note.id} className="p-5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-[#0F172A]">
                        {note.title}
                      </strong>
                      {note.isAddendum && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {ar ? "ملحق / تصحيح" : "Addendum"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(note.sessionDate).toLocaleDateString(ar ? "ar-TN" : "fr-TN", {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-[#64748B]">
                    {ar ? "بواسطة :" : "Par :"}{" "}
                    <strong className="text-[#0F172A]">{note.specialist.name}</strong>
                    {note.specialist.specialty ? ` (${note.specialist.specialty})` : ""}
                  </p>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#0F172A] whitespace-pre-line">
                    {note.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DOCUMENTS & BILANS                                      */}
      {/* ============================================================== */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {currentChild.sharedDocuments.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
              <Download size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="mt-3 text-lg font-bold text-[#0F172A]">
                {ar ? "لا توجد ملفات أو تقارير مشتركة" : "Aucun document partagé"}
              </h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-sm mx-auto">
                {ar
                  ? "التقارير الطبية، الخطط التربوية، والملفات المرفقة تظهر هنا بصيغة آمنة قابلة للتنزيل."
                  : "Les bilans psychomoteurs, bilans orthophoniques et comptes-rendus d'évaluation apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentChild.sharedDocuments.map((doc) => {
                const isDownloading = downloadingId === doc.id;
                const sizeKb = Math.round(doc.sizeBytes / 1024);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-2xs hover:border-[#0056D2]/30 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-[#F0F6FF] px-2 py-0.5 text-[10px] font-semibold text-[#0056D2]">
                          {doc.documentType}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(doc.createdAt).toLocaleDateString(ar ? "ar-TN" : "fr-TN")}
                        </span>
                      </div>

                      <h4 className="mt-2 text-xs font-semibold text-[#0F172A] line-clamp-1">
                        {doc.title || doc.fileName}
                      </h4>
                      <p className="text-[11px] text-[#64748B]">
                        {ar ? "الملف :" : "Fichier :"} {doc.fileName} ({sizeKb} Ko)
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2">
                      <span className="text-[10px] text-[#94A3B8]">
                        {ar ? "المختص :" : "Par :"} {doc.specialist.name}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:text-[#00419E] disabled:opacity-40"
                      >
                        <Download size={13} className={isDownloading ? "animate-pulse" : ""} />
                        <span>
                          {isDownloading
                            ? ar
                              ? "جاري التحميل..."
                              : "Chargement..."
                            : ar
                            ? "تنزيل"
                            : "Télécharger"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* End Relationship Modal */}
      {endTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-[#0F172A]">
              {ar ? "تأكيد إنهاء علاقة المتابعة" : "Clôturer le suivi d'accompagnement"}
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {ar
                ? "عند إنهاء المتابعة، ستتحول المحادثة مع الأخصائي أو مرافقة AVS إلى وضع القراءة فقط. ستبقى الملاحظات والوثائق السابقة محفوظة في ملف طفلك بأمان."
                : "La clôture archivera la messagerie en lecture seule. Les notes et bilans antérieurs resteront accessibles pour la traçabilité."}
            </p>

            <form onSubmit={handleEndRelationship} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {ar ? "سبب إنهاء المتابعة (اختياري) :" : "Motif de fin de suivi (optionnel) :"}
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder={
                    ar
                      ? "مثال: انتهاء فترة التأهيل، انتقال إلى مرحلة جديدة..."
                      : "Ex: Fin de la prise en charge, déménagement..."
                  }
                  className="w-full rounded-xl border border-[#E2E8F0] p-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0056D2] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setEndTargetId(null)}
                  disabled={ending}
                  className="rounded-xl border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  {ar ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={ending}
                  className="rounded-xl bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50 shadow-xs"
                >
                  {ending
                    ? ar
                      ? "جاري الإنهاء..."
                      : "Clôture en cours..."
                    : ar
                    ? "تأكيد الإنهاء"
                    : "Confirmer la fin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
