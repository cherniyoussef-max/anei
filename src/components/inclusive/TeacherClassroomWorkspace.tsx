"use client";

import React, { useState, useMemo, useCallback } from "react";
import JSZip from "jszip";
import {
  Users,
  FileCheck2,
  FilePenLine,
  HelpCircle,
  Library,
  Palette,
  Volume2,
  Download,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Sparkles,
  RefreshCw,
  FolderArchive,
  Eye,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { Locale } from "@/types";
import {
  DIFFICULTIES,
  ADAPTATIONS,
  COLOR_PALETTES,
  DifficultyKey,
  AdaptationKey,
  PalettePreset,
  computeRecommendedAdaptations,
  getDifficultyColor,
} from "@/lib/inclusive-taxonomy";

interface StudentData {
  id: string;
  displayName: string;
  difficulties: DifficultyKey[];
  adaptations: AdaptationKey[];
  personalNote: string;
  downloadStatus: string;
}

interface SpecialistTipData {
  id: string;
  authorName: string;
  difficultyKey: string;
  situationTitle: string;
  whatToDo: string;
  whatToAvoid: string;
}

export interface EvaluationQuestionData {
  full: string;
  simple: string;
  icon: string;
}

export interface EvaluationData {
  id?: string;
  title: string;
  durationMinutes: number;
  questions: EvaluationQuestionData[];
}

interface TeacherClassroomWorkspaceProps {
  locale: Locale;
  initialClassroom: {
    id: string;
    className: string;
    palettePreset: string;
    customColorsJson?: Record<string, string> | null;
  };
  initialStudents: StudentData[];
  initialTips: SpecialistTipData[];
  initialEvaluation?: EvaluationData | null;
}

const DEFAULT_SAMPLE_TEST = {
  title: "Évaluation de français : lecture et compréhension",
  durationMinutes: 45,
  questions: [
    {
      full: "Lis attentivement le texte, puis relève trois verbes conjugués au passé composé dans les deux premiers paragraphes.",
      simple: "Lis le texte. Trouve 3 verbes au passé composé.",
      icon: "1",
    },
    {
      full: "Explique avec tes propres mots pourquoi le personnage principal décide de quitter son village à l'aube.",
      simple: "Pourquoi le personnage quitte-t-il son village ? Écris 1 phrase simple.",
      icon: "2",
    },
    {
      full: "Recopie la phrase correcte parmi les propositions suivantes et justifie ton choix grammatical.",
      simple: "Choisis la phrase correcte. Entoure ton choix.",
      icon: "3",
    },
    {
      full: "Rédige un court paragraphe de cinq lignes décrivant ton lieu préféré en utilisant au moins deux adjectifs qualificatifs.",
      simple: "Décris ton lieu préféré. Écris 3 phrases courtes.",
      icon: "4",
    },
  ],
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateDocxZip(student: StudentData, test: EvaluationData): JSZip {
  const a = student.adaptations;
  const isDysFont = a.includes("font");
  const isBigFont = a.includes("big");
  const isContrast = a.includes("contrast");
  const isSteps = a.includes("steps");
  const isSimple = a.includes("simple");
  const isTimeBonus = a.includes("time");
  const isOral = a.includes("oral");
  const isPauses = a.includes("pauses");

  const fontName = isDysFont ? "Verdana" : "Calibri";
  const fontSizeHalfPt = isBigFont ? 40 : 24; // 20pt vs 12pt

  const runXml = (text: string, bold = false, size = fontSizeHalfPt) => `
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>
        ${bold ? "<w:b/>" : ""}
        ${isContrast ? '<w:color w:val="FFFF00"/>' : ""}
        ${isDysFont ? '<w:spacing w:val="12"/>' : ""}
        <w:sz w:val="${size}"/>
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(text)}</w:t>
    </w:r>
  `;

  const paragraphXml = (content: string, pageBreak = false) => `
    <w:p>
      <w:pPr>
        ${pageBreak ? "<w:pageBreakBefore/>" : ""}
        ${isContrast ? '<w:shd w:val="clear" w:color="auto" w:fill="000000"/>' : ""}
        <w:spacing w:after="180" w:line="${isDysFont ? 420 : 300}" w:lineRule="auto"/>
      </w:pPr>
      ${content}
    </w:p>
  `;

  let body = "";
  // Header
  body += paragraphXml(runXml(test.title, true, fontSizeHalfPt + 8));
  body += paragraphXml(runXml(`Élève : ${student.displayName}    |    Date : ____ / ____ / ______`, false, fontSizeHalfPt - 2));

  if (test.durationMinutes) {
    const finalDur = isTimeBonus ? Math.round(test.durationMinutes * 1.33) : test.durationMinutes;
    const durText = `Durée allouée : ${finalDur} minutes ${isTimeBonus ? "(temps majoré tiers-temps)" : ""}${
      isPauses ? " · pauses courtes autorisées" : ""
    }`;
    body += paragraphXml(runXml(durText, false, fontSizeHalfPt - 2));
  }

  if (a.length > 0) {
    const amDesc = a.map((k) => ADAPTATIONS[k]?.labelFr || k).join(", ");
    body += paragraphXml(runXml(`Aménagements inclus : ${amDesc}`, false, fontSizeHalfPt - 4));
  }

  // Questions
  test.questions.forEach((q, idx) => {
    const prefix = isSteps ? `Étape ${idx + 1} sur ${test.questions.length} : ` : `${idx + 1}. `;
    const qText = isSimple ? q.simple : q.full;
    const qContent = runXml(prefix, true) + runXml(qText, false);
    body += paragraphXml(qContent, isSteps && idx > 0);

    if (isOral) {
      body += paragraphXml(runXml("[ Consigne adaptée : Réponse orale ou dictée vocale autorisée ]", false, fontSizeHalfPt - 4));
    }

    // Answer lines
    for (let line = 0; line < 3; line++) {
      body += paragraphXml(runXml("____________________________________________________________________"));
    }
  });

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>'
  );
  return zip;
}

export function TeacherClassroomWorkspace({
  locale,
  initialClassroom,
  initialStudents,
  initialTips,
  initialEvaluation,
}: TeacherClassroomWorkspaceProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<"class" | "test" | "gen" | "faq" | "res" | "col">("class");
  const [students, setStudents] = useState<StudentData[]>(initialStudents);
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(0);
  const [filterDifficulty, setFilterDifficulty] = useState<DifficultyKey | null>(null);
  const [customColors, setCustomColors] = useState<Record<string, string>>(
    initialClassroom.customColorsJson || {}
  );
  const [palettePreset, setPalettePreset] = useState<PalettePreset>(
    (initialClassroom.palettePreset as PalettePreset) || "Classique"
  );
  const [tips] = useState<SpecialistTipData[]>(initialTips);
  const [evaluation, _setEvaluation] = useState<EvaluationData>(
    initialEvaluation || {
      title: DEFAULT_SAMPLE_TEST.title,
      durationMinutes: DEFAULT_SAMPLE_TEST.durationMinutes,
      questions: DEFAULT_SAMPLE_TEST.questions,
    }
  );

  // Test Adapter state
  const [testStep, setTestStep] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  // Text Generator state
  const [genInput, setGenInput] = useState<string>(
    "Le renard roux s'est faufilé discrètement à travers le sous-bois automnal. Il a observé la clairière silencieuse avec une immense attention avant de s'élancer vers la colline."
  );

  // New Student state
  const [newStudentName, setNewStudentName] = useState<string>("");
  const [savingNote, setSavingNote] = useState<boolean>(false);

  const currentStudent = students[currentStudentIndex] || students[0];

  const getColor = useCallback(
    (key: DifficultyKey) => {
      return getDifficultyColor(key, palettePreset, customColors);
    },
    [palettePreset, customColors]
  );

  // Filtered students
  const visibleStudents = useMemo(() => {
    if (!filterDifficulty) return students;
    return students.filter((s) => s.difficulties.includes(filterDifficulty));
  }, [students, filterDifficulty]);

  // Difficulty counters
  const diffCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(DIFFICULTIES).forEach((k) => {
      counts[k] = students.filter((s) => s.difficulties.includes(k as DifficultyKey)).length;
    });
    return counts;
  }, [students]);

  // Student toggle difficulty
  const toggleStudentDifficulty = async (diffKey: DifficultyKey) => {
    if (!currentStudent) return;
    const exists = currentStudent.difficulties.includes(diffKey);
    const updatedDiffs = exists
      ? currentStudent.difficulties.filter((d) => d !== diffKey)
      : [...currentStudent.difficulties, diffKey];

    const updatedAdaptations = computeRecommendedAdaptations(updatedDiffs);

    const updated = {
      ...currentStudent,
      difficulties: updatedDiffs,
      adaptations: updatedAdaptations,
    };

    const nextStudents = [...students];
    nextStudents[currentStudentIndex] = updated;
    setStudents(nextStudents);

    // Persist to server
    try {
      await fetch("/api/teacher/classroom/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentStudent.id,
          displayName: currentStudent.displayName,
          difficulties: updatedDiffs,
          adaptations: updatedAdaptations,
          personalNote: currentStudent.personalNote,
          downloadStatus: currentStudent.downloadStatus,
        }),
      });
    } catch (e) {
      console.error("Failed to persist student difficulty update:", e);
    }
  };

  // Student toggle adaptation manually
  const toggleStudentAdaptation = async (adKey: AdaptationKey) => {
    if (!currentStudent) return;
    const exists = currentStudent.adaptations.includes(adKey);
    const updatedAdaptations = exists
      ? currentStudent.adaptations.filter((a) => a !== adKey)
      : [...currentStudent.adaptations, adKey];

    const updated = {
      ...currentStudent,
      adaptations: updatedAdaptations,
    };

    const nextStudents = [...students];
    nextStudents[currentStudentIndex] = updated;
    setStudents(nextStudents);

    try {
      await fetch("/api/teacher/classroom/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentStudent.id,
          displayName: currentStudent.displayName,
          difficulties: currentStudent.difficulties,
          adaptations: updatedAdaptations,
          personalNote: currentStudent.personalNote,
          downloadStatus: currentStudent.downloadStatus,
        }),
      });
    } catch (e) {
      console.error("Failed to persist student adaptation update:", e);
    }
  };

  // Add new student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newStudentName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/teacher/classroom/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          difficulties: [],
          adaptations: [],
          personalNote: "",
          downloadStatus: "A_TELECHARGER",
        }),
      });
      const data = await res.json();
      if (data.ok && data.student) {
        setStudents([...students, data.student]);
        setCurrentStudentIndex(students.length);
        setNewStudentName("");
      }
    } catch (err) {
      console.error("Error creating student:", err);
    }
  };

  // Delete student
  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm(ar ? "هل أنت متأكد من حذف هذا التلميذ؟" : "Supprimer cet élève de la classe ?")) return;
    try {
      await fetch("/api/teacher/classroom/student", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId }),
      });
      const next = students.filter((s) => s.id !== studentId);
      setStudents(next);
      if (currentStudentIndex >= next.length) {
        setCurrentStudentIndex(Math.max(0, next.length - 1));
      }
    } catch (err) {
      console.error("Error deleting student:", err);
    }
  };

  // Save personal note
  const handleSaveNote = async (newNote: string) => {
    if (!currentStudent) return;
    const next = [...students];
    next[currentStudentIndex] = { ...currentStudent, personalNote: newNote };
    setStudents(next);

    setSavingNote(true);
    try {
      await fetch("/api/teacher/classroom/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentStudent.id,
          displayName: currentStudent.displayName,
          difficulties: currentStudent.difficulties,
          adaptations: currentStudent.adaptations,
          personalNote: newNote,
          downloadStatus: currentStudent.downloadStatus,
        }),
      });
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      setTimeout(() => setSavingNote(false), 500);
    }
  };

  // Append tip to student note
  const handleAppendTipToNote = async (text: string) => {
    if (!currentStudent) return;
    const addition = currentStudent.personalNote
      ? `${currentStudent.personalNote}\n• ${text}`
      : `• ${text}`;
    await handleSaveNote(addition);
    setFeedbackMessage(ar ? "تمت الإضافة إلى بطاقة التلميذ بنجاح!" : "Conseil ajouté à la fiche de l'élève.");
    setTimeout(() => setFeedbackMessage(""), 3000);
  };

  // Download single docx
  const handleDownloadDocx = async (student: StudentData) => {
    setIsExporting(true);
    try {
      const zip = generateDocxZip(student, evaluation);
      const blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        compression: "DEFLATE",
      });
      const cleanName = student.displayName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "_");
      downloadBlob(blob, `Evaluation_adaptee_${cleanName}.docx`);

      // Mark as downloaded in local state and persist to PostgreSQL
      const next = students.map((s) => (s.id === student.id ? { ...s, downloadStatus: "TELECHARGE" } : s));
      setStudents(next);
      void fetch("/api/teacher/classroom/student/download-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, downloadStatus: "TELECHARGE" }),
      }).catch((err) => console.error("Failed to persist download status:", err));

      setFeedbackMessage(ar ? `تم تنزيل مستند ${student.displayName}` : `Document généré pour ${student.displayName}.`);
    } catch (err) {
      console.error("Docx generation failed:", err);
      setFeedbackMessage(ar ? "حدث خطأ أثناء التنزيل" : "Erreur lors de la génération du document.");
    } finally {
      setIsExporting(false);
      setTimeout(() => setFeedbackMessage(""), 3500);
    }
  };

  // Download all as ZIP
  const handleDownloadAllZip = async () => {
    setIsExporting(true);
    try {
      const masterZip = new JSZip();
      for (const st of students) {
        const studentZip = generateDocxZip(st, evaluation);
        const stBlob = await studentZip.generateAsync({
          type: "uint8array",
          compression: "DEFLATE",
        });
        const cleanName = st.displayName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "_");
        masterZip.file(`Evaluation_${cleanName}.docx`, stBlob);
      }
      const finalZipBlob = await masterZip.generateAsync({ type: "blob" });
      downloadBlob(finalZipBlob, "Evaluations_adaptees_classe_complete.zip");

      const next = students.map((s) => ({ ...s, downloadStatus: "TELECHARGE" }));
      setStudents(next);
      void fetch("/api/teacher/classroom/student/download-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, downloadStatus: "TELECHARGE" }),
      }).catch((err) => console.error("Failed to persist batch download status:", err));

      setFeedbackMessage(ar ? "تم تنزيل أرشيف القسم بالكامل (ZIP)" : `Les ${students.length} documents ont été téléchargés.`);
    } catch (err) {
      console.error("Zip export error:", err);
      setFeedbackMessage(ar ? "خطأ في تصدير الأرشيف" : "Erreur lors de l'export de l'archive.");
    } finally {
      setIsExporting(false);
      setTimeout(() => setFeedbackMessage(""), 4000);
    }
  };

  // Speech synthesis TTS
  const handleSpeakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert(ar ? "القراءة الصوتية غير مدعومة في هذا المتصفح" : "La lecture vocale n'est pas supportée sur ce navigateur.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = ar ? "ar-XA" : "fr-FR";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Color change
  const handleColorChange = async (diffKey: DifficultyKey, colorHex: string) => {
    const nextCustom = { ...customColors, [diffKey]: colorHex };
    setCustomColors(nextCustom);
    setPalettePreset("Personnalisée");

    try {
      await fetch("/api/teacher/classroom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palettePreset: "Personnalisée",
          customColorsJson: nextCustom,
        }),
      });
    } catch (e) {
      console.error("Failed to persist custom color:", e);
    }
  };

  const handlePaletteSelect = async (preset: PalettePreset) => {
    setPalettePreset(preset);
    try {
      await fetch("/api/teacher/classroom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palettePreset: preset,
        }),
      });
    } catch (e) {
      console.error("Failed to persist palette preset:", e);
    }
  };

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Top Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0056D2]/10 text-[#0056D2]">
              <Users className="w-4 h-4 stroke-[1.8]" />
            </span>
            <h1 className="text-xl font-bold text-[#0A192F]">
              {ar ? "فضاء الأستاذ : قسمي الدامج" : "Ma classe inclusive - Espace enseignant"}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {ar
              ? "إدارة تكييفات الاختبارات، بطاقات المتابعة الفردية، وتوليد نصوص بصيغة OpenXML و Word مهيأة للطباعة."
              : "Gestion personnalisée des adaptations pédagogiques, générateur d'évaluations adaptées et guides réflexes."}
          </p>
        </div>

        {/* Global Student Selector in Header */}
        {students.length > 0 && (
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 shrink-0">
              {ar ? "التلميذ المحدد :" : "Élève actif :"}
            </span>
            <select
              value={currentStudentIndex}
              onChange={(e) => setCurrentStudentIndex(Number(e.target.value))}
              aria-label={ar ? "اختر التلميذ" : "Sélectionner un élève"}
              className="text-xs font-bold text-[#0A192F] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0056D2] max-w-[200px] sm:max-w-xs truncate"
            >
              {students.map((st, idx) => (
                <option key={st.id} value={idx}>
                  {st.displayName} {st.difficulties.length > 0 ? `(${st.difficulties.map(d => DIFFICULTIES[d]?.labelFr || d).join(", ")})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        {[
          { key: "class", icon: Users, fr: "Ma classe inclusive", ar: "قسمي الدامج" },
          { key: "test", icon: FileCheck2, fr: "Adapter un test", ar: "تكييف اختبار" },
          { key: "gen", icon: FilePenLine, fr: "Générateur d'adaptations", ar: "مولّد التكييفات" },
          { key: "faq", icon: HelpCircle, fr: "Que faire en classe", ar: "ماذا أفعل في القسم" },
          { key: "res", icon: Library, fr: "Ressources adaptées", ar: "الموارد المكيفة" },
          { key: "col", icon: Palette, fr: "Palette & Couleurs", ar: "الألوان والترميز" },
        ].map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? "bg-[#0A192F] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>{ar ? tab.ar : tab.fr}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-600 stroke-[2]" />
            {feedbackMessage}
          </span>
        </div>
      )}

      {/* =========================================================================
          TAB 1: MA CLASSE INCLUSIVE
      ========================================================================= */}
      {activeTab === "class" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of Students & Filter */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {ar ? "تصفية حسب الصعوبة" : "Filtrer par difficulté"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterDifficulty(null)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    filterDifficulty === null
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {ar ? `الكل (${students.length})` : `Tous (${students.length})`}
                </button>
                {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((k) => {
                  const count = diffCounts[k] || 0;
                  const color = getColor(k);
                  const active = filterDifficulty === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFilterDifficulty(active ? null : k)}
                      style={{
                        borderColor: active ? color : undefined,
                        backgroundColor: active ? `${color}15` : undefined,
                        color: active ? color : undefined,
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${
                        !active ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50" : ""
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{DIFFICULTIES[k].labelFr}</span>
                      <span className="text-[10px] opacity-75 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Students List */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>{ar ? "قائمة التلاميذ" : "Élèves de la classe"} ({visibleStudents.length})</span>
              </div>

              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pe-1">
                {visibleStudents.map((st) => {
                  const originalIndex = students.findIndex((s) => s.id === st.id);
                  const isCurrent = originalIndex === currentStudentIndex;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCurrentStudentIndex(originalIndex)}
                      className={`w-full text-start p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isCurrent
                          ? "bg-[#0056D2]/5 border-[#0056D2] shadow-xs"
                          : "bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-[#0A192F]">{st.displayName}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {st.difficulties.length > 0 ? (
                            st.difficulties.map((dk) => (
                              <span
                                key={dk}
                                style={{
                                  backgroundColor: `${getColor(dk)}18`,
                                  color: getColor(dk),
                                }}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                              >
                                {DIFFICULTIES[dk]?.labelFr || dk}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {ar ? "بدون صعوبة مسجلة" : "Aucune difficulté"}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 ${ar ? "rotate-180" : ""}`} />
                    </button>
                  );
                })}
              </div>

              {/* Add Student Form */}
              <form onSubmit={handleAddStudent} className="pt-3 border-t border-slate-200/80 flex items-center gap-2">
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder={ar ? "اسم تلميذ جديد..." : "Nom d'un nouvel élève..."}
                  className="text-xs flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                />
                <button
                  type="submit"
                  disabled={!newStudentName.trim()}
                  className="bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2]" />
                  <span>{ar ? "إضافة" : "Ajouter"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Fiche of Selected Student */}
          <div className="lg:col-span-7">
            {currentStudent ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0A192F] flex items-center gap-2">
                      <span>{ar ? `بطاقة المتابعة : ${currentStudent.displayName}` : `Fiche de ${currentStudent.displayName}`}</span>
                      {currentStudent.downloadStatus === "TELECHARGE" && (
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                          {ar ? "تم التنزيل" : "Téléchargé"}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {ar
                        ? "حدد الصعوبات لتفعيل التكييفات التلقائية والتوصيات البيداغوجية."
                        : "Cliquez sur une difficulté pour activer ou désactiver les adaptations automatiques."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteStudent(currentStudent.id)}
                    title={ar ? "حذف التلميذ" : "Supprimer l'élève"}
                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Difficulties Chips Toggle */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {ar ? "الصعوبات المشخصة (انقر للتعديل)" : "Difficultés déclarées (cliquez pour ajouter / retirer)"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => {
                      const active = currentStudent.difficulties.includes(dk);
                      const color = getColor(dk);
                      return (
                        <button
                          key={dk}
                          type="button"
                          onClick={() => toggleStudentDifficulty(dk)}
                          style={{
                            borderColor: active ? color : "#cbd5e1",
                            backgroundColor: active ? `${color}15` : "#ffffff",
                            color: active ? color : "#475569",
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all flex items-center gap-1.5 ${
                            active ? "shadow-2xs ring-1" : "hover:border-slate-400"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: active ? color : "#94a3b8" }}
                          />
                          <span>{DIFFICULTIES[dk].labelFr}</span>
                          {active && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Adaptations Tags */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>{ar ? "التكييفات المفعلة تلقائياً" : "Aménagements prévus"}</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {currentStudent.adaptations.length} {ar ? "تكييف نشط" : "adaptation(s)"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentStudent.adaptations.length > 0 ? (
                      currentStudent.adaptations.map((ak) => (
                        <span
                          key={ak}
                          className="text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0056D2]" />
                          <span>{ADAPTATIONS[ak]?.labelFr || ak}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        {ar ? "لا يوجد أي تكييف مخصص حالياً" : "Aucun aménagement prévu"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Personal Teacher Note */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {ar ? "ملاحظات وتوجيهات خاصة بالتلميذ" : "Note personnelle de l'enseignant"}
                    </span>
                    {savingNote && (
                      <span className="text-[11px] text-[#0056D2] flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        {ar ? "جارٍ الحفظ..." : "Enregistrement..."}
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={currentStudent.personalNote}
                    onChange={(e) => handleSaveNote(e.target.value)}
                    placeholder={
                      ar
                        ? "مثال : يركز بشكل أفضل عند قراءة التعليمات بصوت مسموع..."
                        : "Ex. : ça marche mieux quand je lis la consigne à voix haute..."
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
                  />
                </div>

                {/* Quick Action Shortcuts */}
                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {ar ? "إجراء سريع لهذا التلميذ" : "Commencer une action pour cet élève"}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("test")}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#0056D2]/5 hover:border-[#0056D2] text-start transition-all"
                    >
                      <FileCheck2 className="w-4 h-4 text-[#0056D2] mb-1 stroke-[1.8]" />
                      <div className="text-xs font-bold text-slate-800">{ar ? "تكييف اختبار" : "Adapter un test"}</div>
                      <div className="text-[10px] text-slate-500">{ar ? "توليد Word" : "Générer .docx"}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("gen")}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#0056D2]/5 hover:border-[#0056D2] text-start transition-all"
                    >
                      <FilePenLine className="w-4 h-4 text-emerald-600 mb-1 stroke-[1.8]" />
                      <div className="text-xs font-bold text-slate-800">{ar ? "تكييف نص" : "Adapter un texte"}</div>
                      <div className="text-[10px] text-slate-500">{ar ? "تبسيط فوري" : "FALC / Police"}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("faq")}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#0056D2]/5 hover:border-[#0056D2] text-start transition-all"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-600 mb-1 stroke-[1.8]" />
                      <div className="text-xs font-bold text-slate-800">{ar ? "ماذا أفعل" : "Que faire en classe"}</div>
                      <div className="text-[10px] text-slate-500">{ar ? "توصيات ومواقف" : "Guides réflexes"}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("res")}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#0056D2]/5 hover:border-[#0056D2] text-start transition-all"
                    >
                      <Library className="w-4 h-4 text-purple-600 mb-1 stroke-[1.8]" />
                      <div className="text-xs font-bold text-slate-800">{ar ? "موارد داعمة" : "Ressources"}</div>
                      <div className="text-[10px] text-slate-500">{ar ? "بطاقات وتمارين" : "Fiches & outils"}</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                {ar ? "الرجاء اختيار أو إضافة تلميذ" : "Sélectionnez un élève pour afficher sa fiche."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADAPTER UN TEST (WIZARD: IMPORTER -> ADAPTER -> TÉLÉCHARGER)
      ========================================================================= */}
      {activeTab === "test" && (
        <div className="space-y-6">
          {/* Stepper Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              {[
                { step: 0, fr: "1. Importer le test", ar: "1. استيراد الاختبار" },
                { step: 1, fr: "2. Prévisualiser & Adapter", ar: "2. المعاينة والتكييف" },
                { step: 2, fr: "3. Télécharger les documents", ar: "3. تنزيل الوثائق" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setTestStep(s.step)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    testStep === s.step
                      ? "bg-[#0056D2] text-white"
                      : testStep > s.step
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {ar ? s.ar : s.fr}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{evaluation.title}</span>
              <span>· {evaluation.questions.length} questions · {evaluation.durationMinutes} min</span>
            </div>
          </div>

          {/* Step 0: Importer */}
          {testStep === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-[#0056D2]/10 text-[#0056D2] mx-auto flex items-center justify-center">
                <FileText className="w-7 h-7 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0A192F]">
                  {ar ? "اختبار نموذجي محمل جاهز للتكييف" : "Évaluation prête pour adaptation"}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  {ar
                    ? "تم استيراد اختبار اللغة الفرنسية من قاعدة البيانات. يمكنك معاينة التكييفات لكل تلميذ أو تصدير النسخ."
                    : "L'évaluation est chargée depuis PostgreSQL pour l'ensemble des élèves de la classe."}
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl max-w-lg mx-auto text-start space-y-2">
                <div className="text-xs font-bold text-slate-700">{evaluation.title}</div>
                <div className="text-xs text-slate-600 space-y-1">
                  {evaluation.questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11.5px]">
                      <span className="font-mono text-slate-400">{i + 1}.</span>
                      <span className="truncate">{q.full}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTestStep(1)}
                className="bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>{ar ? "الانتقال إلى المعاينة والتكييف" : "Passer à l'étape 2 : Adapter"}</span>
                <ChevronRight className={`w-4 h-4 ${ar ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}

          {/* Step 1: Prévisualiser & Adapter */}
          {testStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Controls: Select Student & Toggle Adaptations */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {ar ? "تكييف الوثيقة للتلميذ :" : "Adapter spécifiquement pour :"}
                  </div>
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {students.map((st, idx) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setCurrentStudentIndex(idx)}
                        className={`w-full text-start p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                          idx === currentStudentIndex
                            ? "bg-[#0056D2] text-white border-[#0056D2]"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span>{st.displayName}</span>
                        <span className="text-[10px] opacity-80">
                          {st.difficulties.length > 0 ? st.difficulties.join(", ") : "Standard"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aménagements Toggles */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {ar ? "خيارات التكييف النشطة (انقر للتعديل)" : "Aménagements appliqués en direct"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ADAPTATIONS) as AdaptationKey[]).map((ak) => {
                      const active = currentStudent?.adaptations.includes(ak);
                      return (
                        <button
                          key={ak}
                          type="button"
                          onClick={() => toggleStudentAdaptation(ak)}
                          className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium transition-all flex items-center gap-1.5 ${
                            active
                              ? "bg-[#0A192F] text-white border-[#0A192F] shadow-xs"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <Check className={`w-3 h-3 ${active ? "opacity-100" : "opacity-0"}`} />
                          <span>{ADAPTATIONS[ak].labelFr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadDocx(currentStudent)}
                    disabled={isExporting}
                    className="flex-1 bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{ar ? "تنزيل Word (.docx)" : "Télécharger son Word (.docx)"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestStep(2)}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-1.5"
                  >
                    <span>{ar ? "التالي" : "Suivant"}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ${ar ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Right Live Document Preview */}
              <div className="lg:col-span-7">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Eye className="w-4 h-4 text-slate-400" />
                      {ar ? "معاينة الوثيقة المطبوعة للتقييم" : "Aperçu en direct du document adapté"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleSpeakText(
                          evaluation.questions.map((q, i) => `Question ${i + 1} : ${currentStudent.adaptations.includes("simple") ? q.simple : q.full}`).join(". ")
                        )
                      }
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                      title={ar ? "قراءة صوتية" : "Écouter la lecture vocale"}
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[#0056D2]" />
                      <span>{ar ? "استماع" : "Lecture vocale"}</span>
                    </button>
                  </div>

                  {/* Rendered Document Sheet Container */}
                  <div
                    style={{
                      backgroundColor: currentStudent.adaptations.includes("contrast") ? "#000000" : "#ffffff",
                      color: currentStudent.adaptations.includes("contrast") ? "#FFFF00" : "#0A192F",
                      fontFamily: currentStudent.adaptations.includes("font") ? "Verdana, Tahoma, sans-serif" : "inherit",
                      fontSize: currentStudent.adaptations.includes("big") ? "17px" : "13.5px",
                      lineHeight: currentStudent.adaptations.includes("font") ? 1.9 : 1.6,
                      letterSpacing: currentStudent.adaptations.includes("font") ? "0.04em" : "normal",
                    }}
                    className="p-6 border border-slate-300 rounded-xl min-h-[380px] shadow-inner space-y-4 transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-lg">{evaluation.title}</h4>
                      <div className="text-xs opacity-75 mt-0.5">
                        {ar ? `التلميذ : ${currentStudent.displayName}` : `Élève : ${currentStudent.displayName}`} ·{" "}
                        {currentStudent.adaptations.includes("time")
                          ? `${Math.round(evaluation.durationMinutes * 1.33)} min (tiers-temps +33 %)`
                          : `${evaluation.durationMinutes} min`}
                        {currentStudent.adaptations.includes("pauses") ? " · pauses courtes régulières" : ""}
                      </div>
                    </div>

                    <div className="border-t border-current/20 pt-3 space-y-4">
                      {evaluation.questions.map((q, i) => {
                        const isSimple = currentStudent.adaptations.includes("simple");
                        const isSteps = currentStudent.adaptations.includes("steps");
                        const isPictos = currentStudent.adaptations.includes("pictos");
                        const isOral = currentStudent.adaptations.includes("oral");
                        return (
                          <div key={i} className="space-y-1">
                            <div className="font-semibold flex items-start gap-2">
                              {isPictos && (
                                <span className="inline-block px-1.5 py-0.5 bg-current/10 rounded text-xs font-mono">
                                  {q.icon}
                                </span>
                              )}
                              <span>
                                {isSteps ? `Étape ${i + 1} sur ${evaluation.questions.length} : ` : `${i + 1}. `}
                                {isSimple ? q.simple : q.full}
                              </span>
                            </div>
                            {isOral && (
                              <div className="text-xs opacity-80 ps-5 italic">
                                🎤 {ar ? "يمكنك الإجابة شفوياً." : "Tu peux répondre à l'oral."}
                              </div>
                            )}
                            <div className="border-b border-dashed border-current/30 pt-4" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Télécharger (Summary table & ZIP archive) */}
          {testStep === 2 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0A192F]">
                    {ar ? "تنزيل الوثائق المهيأة للقسم بالكامل" : "Téléchargement des épreuves adaptées"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {ar
                      ? "قم بتنزيل مستند كل تلميذ على حدة بصيغة Word (.docx) أو قم بتنزيل حزمة كاملة بصيغة ZIP."
                      : "Chaque fichier Word contient les polices agrandies, consignes FALC et balises OpenXML correspondantes."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={isExporting}
                  className="bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors"
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>{ar ? "تنزيل أرشيف القسم (.zip)" : "Tout télécharger (.zip)"}</span>
                </button>
              </div>

              {/* Table of students */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 text-start">{ar ? "التلميذ" : "Élève"}</th>
                      <th className="py-2.5 text-start">{ar ? "التكييفات المضمنة" : "Aménagements"}</th>
                      <th className="py-2.5 text-start">{ar ? "الحالة" : "Statut"}</th>
                      <th className="py-2.5 text-end">{ar ? "إجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70">
                        <td className="py-3 font-bold text-slate-800">{st.displayName}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {st.adaptations.length > 0 ? (
                              st.adaptations.map((ak) => (
                                <span
                                  key={ak}
                                  className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                                >
                                  {ADAPTATIONS[ak]?.labelFr || ak}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">{ar ? "بدون تكييف" : "Standard"}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                              st.downloadStatus === "TELECHARGE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {st.downloadStatus === "TELECHARGE"
                              ? ar
                                ? "تم التنزيل"
                                : "Téléchargé"
                              : ar
                              ? "في انتظار التنزيل"
                              : "À télécharger"}
                          </span>
                        </td>
                        <td className="py-3 text-end">
                          <button
                            type="button"
                            onClick={() => handleDownloadDocx(st)}
                            className="bg-white hover:bg-slate-50 text-[#0056D2] border border-[#0056D2]/30 text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>.docx</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: GÉNÉRATEUR D'ADAPTATIONS RAPIDE (TEXTE / LEÇON)
      ========================================================================= */}
      {activeTab === "gen" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {ar ? "الصق أي نص أو محتوى درس هنا" : "Texte à adapter"}
              </div>
              <textarea
                rows={6}
                value={genInput}
                onChange={(e) => setGenInput(e.target.value)}
                placeholder={ar ? "اكتب أو الصق نصاً لتكييفه فورياً..." : "Collez ou écrivez un texte..."}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0056D2]"
              />

              {/* Aménagements Toggle */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {ar ? "تطبيق التكييفات" : "Aménagements"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ADAPTATIONS) as AdaptationKey[]).map((ak) => {
                    const active = currentStudent?.adaptations.includes(ak);
                    return (
                      <button
                        key={ak}
                        type="button"
                        onClick={() => toggleStudentAdaptation(ak)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          active
                            ? "bg-[#0A192F] text-white border-[#0A192F]"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span>{ADAPTATIONS[ak].labelFr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const customTest = {
                      title: "Texte adapté en classe",
                      durationMinutes: 0,
                      questions: genInput
                        .split(/(?<=[.!?])\s+/)
                        .filter(Boolean)
                        .map((s, idx) => ({ full: s, simple: s, icon: String(idx + 1) })),
                    };
                    const zip = generateDocxZip(currentStudent, customTest);
                    zip.generateAsync({ type: "blob" }).then((blob) => {
                      downloadBlob(blob, `Texte_adapte_${currentStudent.displayName}.docx`);
                    });
                  }}
                  className="flex-1 bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{ar ? "تصدير Word (.docx)" : "Exporter Word (.docx)"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Live Preview */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-400" />
                  {ar ? "المعاينة الفورية للنص المكيف" : "Aperçu du texte adapté"}
                </span>
                <button
                  type="button"
                  onClick={() => handleSpeakText(genInput)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#0056D2]" />
                  <span>{ar ? "استماع" : "Lecture vocale"}</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: currentStudent.adaptations.includes("contrast") ? "#000000" : "#ffffff",
                  color: currentStudent.adaptations.includes("contrast") ? "#FFFF00" : "#0A192F",
                  fontFamily: currentStudent.adaptations.includes("font") ? "Verdana, Tahoma, sans-serif" : "inherit",
                  fontSize: currentStudent.adaptations.includes("big") ? "18px" : "14px",
                  lineHeight: currentStudent.adaptations.includes("font") ? 1.9 : 1.6,
                  letterSpacing: currentStudent.adaptations.includes("font") ? "0.04em" : "normal",
                }}
                className="p-6 border border-slate-300 rounded-xl min-h-[300px] shadow-inner space-y-3"
              >
                <h4 className="font-bold text-base">{ar ? "النص المكيف للتلميذ" : "Texte adapté"}</h4>
                <div className="space-y-3">
                  {genInput
                    .split(/(?<=[.!?])\s+/)
                    .filter(Boolean)
                    .map((sentence, idx) => (
                      <p key={idx} className="flex items-start gap-2">
                        {currentStudent.adaptations.includes("steps") && (
                          <span className="font-bold opacity-80 text-xs mt-0.5">Étape {idx + 1} :</span>
                        )}
                        <span>{sentence}</span>
                      </p>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: QUE FAIRE EN CLASSE (REFLEX GUIDES + SPECIALIST TIPS)
      ========================================================================= */}
      {activeTab === "faq" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-base font-bold text-[#0A192F] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#0056D2]" />
              <span>
                {ar
                  ? `التوجيهات البيداغوجية المناسبة لحالة : ${currentStudent.displayName}`
                  : `Que faire en classe pour ${currentStudent.displayName}`}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {ar
                ? "دليل الإجراءات الفورية والسلوكيات الموصى بها في القسم، مصادق عليها من طرف الأخصائيين النفسيين ومستشاري الإدماج المدرسي."
                : "Guides réflexes et conseils pratiques validés par nos spécialistes pour chaque situation vécue."}
            </p>
          </div>

          {currentStudent.difficulties.length > 0 ? (
            <div className="space-y-6">
              {currentStudent.difficulties.map((dk) => {
                const diffDef = DIFFICULTIES[dk];
                const color = getColor(dk);
                // Also get specialist tips for this difficulty
                const matchingTips = tips.filter((t) => t.difficultyKey === dk);

                return (
                  <div key={dk} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <h4 className="text-sm font-bold text-[#0A192F] uppercase tracking-wider">
                        {diffDef?.labelFr || dk}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Built-in reflex tips */}
                      {diffDef?.reflexTips.map((tip, idx) => (
                        <div
                          key={idx}
                          style={{ borderInlineStartColor: color }}
                          className="border border-slate-200 border-s-4 rounded-xl p-4 bg-slate-50/60 space-y-2"
                        >
                          <div className="text-xs font-bold text-slate-900">{tip.situation}</div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                              {ar ? "ما يجب فعله :" : "Que faire :"}
                            </span>
                            <p className="text-xs text-slate-700 mt-0.5">{tip.whatToDo}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                              {ar ? "ما يجب تجنبه :" : "À éviter :"}
                            </span>
                            <p className="text-xs text-slate-600 mt-0.5">{tip.whatToAvoid}</p>
                          </div>
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => handleAppendTipToNote(`${tip.situation} : ${tip.whatToDo}`)}
                              className="text-[11px] text-[#0056D2] font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{ar ? "إضافة إلى بطاقة التلميذ" : "Ajouter à la fiche de l'élève"}</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Specialist-Published Tips from Database */}
                      {matchingTips.map((tip) => (
                        <div
                          key={tip.id}
                          style={{ borderInlineStartColor: color }}
                          className="border border-slate-200 border-s-4 rounded-xl p-4 bg-blue-50/40 space-y-2 relative"
                        >
                          <span className="text-[9.5px] bg-[#0056D2] text-white font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{ar ? "نصيحة أخصائي معتمد" : "Conseil spécialiste"}</span>
                          </span>
                          <div className="text-xs font-bold text-[#0A192F]">{tip.situationTitle}</div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                              {ar ? "التدخل المقترح :" : "Que faire :"}
                            </span>
                            <p className="text-xs text-slate-700 mt-0.5">{tip.whatToDo}</p>
                          </div>
                          {tip.whatToAvoid && (
                            <div>
                              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                                {ar ? "تنبيه وسلوك ممنوع :" : "À éviter :"}
                              </span>
                              <p className="text-xs text-slate-600 mt-0.5">{tip.whatToAvoid}</p>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 italic">
                            {ar ? `المصدر : ${tip.authorName}` : `Publié par : ${tip.authorName}`}
                          </div>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleAppendTipToNote(`${tip.situationTitle} : ${tip.whatToDo}`)}
                              className="text-[11px] text-[#0056D2] font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{ar ? "إضافة إلى بطاقة التلميذ" : "Ajouter à la fiche de l'élève"}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
              <p className="text-xs">
                {ar
                  ? "لم يتم تحديد أي صعوبة لهذا التلميذ. يمكنك إضافة صعوبة في تبويب « قسمي الدامج » لعرض التوصيات."
                  : "Aucune difficulté déclarée pour cet élève. Ajoutez-en une dans « Ma classe inclusive » pour afficher les conseils."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: RESSOURCES ADAPTÉES
      ========================================================================= */}
      {activeTab === "res" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-base font-bold text-[#0A192F] flex items-center gap-2">
              <Library className="w-5 h-5 text-[#0056D2]" />
              <span>{ar ? "المكتبة البيداغوجية التشاركية للموارد المكيفة" : "Ressources adaptées"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {ar
                ? "نماذج وثائق وتمارين وجذاذات جاهزة للتحميل والاستعمال في القسم."
                : "Documents, fiches simplifiées et supports visuels classés par besoin."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(DIFFICULTIES) as DifficultyKey[]).flatMap((dk) => {
              const diffDef = DIFFICULTIES[dk];
              const color = getColor(dk);
              return diffDef.resources.map((res, i) => (
                <div
                  key={`${dk}-${i}`}
                  style={{ borderInlineStartColor: color }}
                  className="bg-white border border-slate-200 border-s-4 rounded-xl p-4 shadow-xs space-y-2.5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{ backgroundColor: `${color}15`, color }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    >
                      {diffDef.labelFr}
                    </span>
                    <span className="text-[10.5px] text-slate-500">{res.discipline}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">{res.title}</div>
                  <div className="text-[11px] text-slate-500">{res.category}</div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-700 font-medium">
                      {ar ? "متاح للطباعة" : "Prêt à imprimer"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const sampleDoc = {
                          title: res.title,
                          durationMinutes: 30,
                          questions: [
                            { full: `Exercice support : ${res.title}`, simple: res.title, icon: "•" },
                          ],
                        };
                        const zip = generateDocxZip(currentStudent, sampleDoc);
                        zip.generateAsync({ type: "blob" }).then((b) => downloadBlob(b, `${res.title}.docx`));
                      }}
                      className="text-xs text-[#0056D2] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>{ar ? "تنزيل" : "Télécharger"}</span>
                    </button>
                  </div>
                </div>
              ));
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: PALETTES & COULEURS ACCESSIBLES
      ========================================================================= */}
      {activeTab === "col" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#0A192F] flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#0056D2]" />
              <span>{ar ? "لوحات الألوان وتخصيص الصعوبات" : "Palettes de couleurs & Daltonisme"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {ar
                ? "اختر لوحة جاهزة تراعي عمى الألوان (Okabe-Ito) أو خصص الألوان وفق نظام مؤسستك."
                : "Choisissez un profil colorimétrique adapté (notamment Daltonien colorblind-safe) ou personnalisez chaque couleur."}
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {ar ? "النماذج المسبقة" : "Préréglages disponibles"}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["Classique", "Pastel", "Daltonien"] as const).map((p) => {
                const active = palettePreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePaletteSelect(p)}
                    className={`text-xs px-3.5 py-2 rounded-xl border font-bold transition-all flex items-center gap-2 ${
                      active
                        ? "bg-[#0A192F] text-white border-[#0A192F] shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>{p}</span>
                    <div className="flex items-center gap-1">
                      {COLOR_PALETTES[p].map((c: string, i: number) => (
                        <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Individual Color Pickers */}
          <div className="space-y-3 pt-3 border-t border-slate-200/80">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {ar ? "تخصيص الألوان لكل صعوبة" : "Personnalisation fine"}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((dk) => {
                const currentColor = getColor(dk);
                return (
                  <label
                    key={dk}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-800">{DIFFICULTIES[dk].labelFr}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleColorChange(dk, e.target.value)}
                        className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-[11px] font-mono text-slate-500 uppercase">{currentColor}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
