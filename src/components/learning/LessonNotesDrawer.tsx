"use client";

import { useEffect, useState } from "react";
import { PenLine, Play, Trash2, Edit2, Download, Check, Plus, Clock } from "lucide-react";
import type { Locale } from "@/types";

function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type PersonalNote = {
  id: string;
  timestampSeconds: number;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

interface LessonNotesDrawerProps {
  lessonId: string;
  initialNotes: PersonalNote[];
  currentTime?: number;
  onSeek?: (seconds: number) => void;
  locale: Locale;
  lessonTitle: string;
}

export function LessonNotesDrawer({
  lessonId,
  initialNotes,
  currentTime,
  onSeek,
  locale,
  lessonTitle,
}: LessonNotesDrawerProps) {
  const [internalTime, setInternalTime] = useState(currentTime ?? 0);
  const [notes, setNotes] = useState<PersonalNote[]>(initialNotes);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const isAr = locale === "ar";

  useEffect(() => {
    if (typeof currentTime === "number") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.currentTime === "number") {
        setInternalTime(detail.currentTime);
      }
    };
    window.addEventListener("anei:video-time-update", handler);
    return () => window.removeEventListener("anei:video-time-update", handler);
  }, [currentTime]);

  const effectiveTime = typeof currentTime === "number" ? currentTime : internalTime;

  const handleSeek = (seconds: number) => {
    if (onSeek) {
      onSeek(seconds);
    } else {
      window.dispatchEvent(new CustomEvent("anei:seek-video", { detail: { seconds } }));
    }
  };

  // Listen for global custom event dispatched from video keyboard shortcut "N"
  useEffect(() => {
    const handleAddNoteEvent = () => {
      const textarea = document.getElementById("new-lesson-note-input");
      textarea?.focus();
    };
    window.addEventListener("anei:add-note-shortcut", handleAddNoteEvent);
    return () => window.removeEventListener("anei:add-note-shortcut", handleAddNoteEvent);
  }, []);

  const handleSaveNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newNoteContent.trim() || saving) return;

    setSaving(true);
    const snapTime = Math.floor(effectiveTime);

    try {
      const res = await fetch("/api/learning/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          timestampSeconds: snapTime,
          content: newNoteContent.trim(),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setNotes((prev) =>
          [...prev, json.note].sort((a, b) => a.timestampSeconds - b.timestampSeconds)
        );
        setNewNoteContent("");
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/learning/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: noteId,
          lessonId,
          content: editContent.trim(),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, content: json.note.content } : n))
        );
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذه الملاحظة؟" : "Supprimer cette note ?")) return;

    try {
      const res = await fetch("/api/learning/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId }),
      });

      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch {
      // ignore
    }
  };

  const handleExport = () => {
    const text =
      `# Notes de cours : ${lessonTitle}\n\n` +
      notes
        .map(
          (n) =>
            `- [${formatSeconds(n.timestampSeconds)}] ${n.content} (créée le ${new Date(
              n.createdAt
            ).toLocaleDateString()})`
        )
        .join("\n");

    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${lessonTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-6">
      {/* Header with Export CTA */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <PenLine size={18} className="text-[#0056D2]" />
          <h3 className="text-sm font-bold text-[#0A192F]">
            {isAr ? "ملاحظاتي الشخصية" : "Mes notes personnelles"}
          </h3>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
            {notes.length}
          </span>
        </div>

        {notes.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span>{isAr ? "تصدير Notes (.md)" : "Exporter (.md)"}</span>
          </button>
        )}
      </div>

      {/* Note Taking Input Box */}
      <form onSubmit={handleSaveNote} className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1 text-[#0056D2] font-semibold">
            <Clock size={13} />
            <span>
              {isAr ? "لقطة زمنية عند" : "Note liée au minutage"}{" "}
              <strong dir="ltr" className="font-mono">{formatSeconds(effectiveTime)}</strong>
            </span>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {isAr ? "اختصار لوحة المفاتيح: N" : "Raccourci clavier : N"}
          </span>
        </div>

        <textarea
          id="new-lesson-note-input"
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder={
            isAr
              ? "اكتب فكرة، سؤالاً أو ملاحظة تطبيقية لصفك..."
              : "Notez une réflexion, une stratégie pour votre classe, une question..."
          }
          rows={2}
          className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2] resize-y"
        />

        <div className="flex items-center justify-end gap-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-600 inline-flex items-center gap-1 font-medium">
              <Check size={14} />
              {isAr ? "تم الحفظ" : "Note enregistrée"}
            </span>
          )}
          <button
            type="submit"
            disabled={!newNoteContent.trim() || saving}
            className="h-8 px-3 rounded-lg bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus size={14} />
            <span>{saving ? (isAr ? "جارٍ الحفظ..." : "Enregistrement...") : (isAr ? "حفظ الملاحظة" : "Ajouter la note")}</span>
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-[#BFDBFE] transition-colors space-y-2 group"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleSeek(note.timestampSeconds)}
                className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#0056D2] hover:bg-[#0056D2] hover:text-white font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                title={isAr ? "الانتقال إلى المقطع" : "Aller à ce passage"}
              >
                <Play size={10} className="fill-current" />
                <span dir="ltr">{formatSeconds(note.timestampSeconds)}</span>
              </button>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(note.id);
                    setEditContent(note.content);
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors"
                  aria-label={isAr ? "تعديل" : "Modifier"}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                  aria-label={isAr ? "حذف" : "Supprimer"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {editingId === note.id ? (
              <div className="space-y-2 pt-1">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden"
                  rows={2}
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="h-7 px-2 text-xs text-slate-500 hover:bg-slate-100 rounded"
                  >
                    {isAr ? "إلغاء" : "Annuler"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateNote(note.id)}
                    className="h-7 px-2.5 text-xs bg-[#0056D2] text-white rounded font-medium"
                  >
                    {isAr ? "حفظ التعديل" : "Enregistrer"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
            )}
          </div>
        ))}

        {notes.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-xs">
            {isAr
              ? "لم تدون أي ملاحظات بعد. اضغط على الزر أعلاه أو المفتاح (N) لحفظ فكرة عند اللحظة الحالية."
              : "Aucune note pour le moment. Cliquez sur le bouton ci-dessus ou appuyez sur (N) pendant la vidéo pour capturer une réflexion liée au minutage."}
          </div>
        )}
      </div>
    </div>
  );
}
