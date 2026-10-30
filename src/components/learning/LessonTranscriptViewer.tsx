"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Play, Download, Copy, Check, Subtitles } from "lucide-react";
import type { Locale } from "@/types";

function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Cue = {
  start: number;
  end: number;
  text: string;
};

interface LessonTranscriptViewerProps {
  cues: Cue[];
  currentTime?: number;
  onSeek?: (seconds: number) => void;
  locale: Locale;
  lessonTitle: string;
}

export function LessonTranscriptViewer({
  cues,
  currentTime,
  onSeek,
  locale,
  lessonTitle,
}: LessonTranscriptViewerProps) {
  const [internalTime, setInternalTime] = useState(currentTime ?? 0);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCueRef = useRef<HTMLDivElement>(null);
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

  // Find currently active cue index
  const activeIndex = useMemo(() => {
    return cues.findIndex((c) => effectiveTime >= c.start && effectiveTime <= c.end + 0.5);
  }, [cues, effectiveTime]);

  // Filtered cues based on user search
  const filteredCues = useMemo(() => {
    if (!search.trim()) return cues;
    const q = search.toLowerCase();
    return cues.filter((c) => c.text.toLowerCase().includes(q));
  }, [cues, search]);

  // Auto-scroll active cue into view smoothly
  useEffect(() => {
    if (!search && activeCueRef.current && containerRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeIndex, search]);

  const handleCopy = () => {
    const fullText = cues.map((c) => `[${formatSeconds(c.start)}] ${c.text}`).join("\n");
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fullText = `${lessonTitle}\n\n` + cues.map((c) => `[${formatSeconds(c.start)}] ${c.text}`).join("\n");
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${lessonTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!cues.length) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
        <Subtitles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium">
          {isAr ? "لا يوجد تفريغ نصي متاح لهذا الدرس حالياً." : "Aucune transcription disponible pour cette leçon."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[520px]">
      {/* Search & Actions Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "بحث في التفريغ النصي..." : "Rechercher dans la transcription..."}
            className="w-full h-9 ps-9 pe-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2]"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isAr ? "نسخ النص" : "Copier"}
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            <span>{copied ? (isAr ? "تم النسخ" : "Copié") : (isAr ? "نسخ" : "Copier")}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isAr ? "تحميل النص TXT" : "Télécharger TXT"}
          >
            <Download size={13} />
            <span className="hidden sm:inline">TXT</span>
          </button>
        </div>
      </div>

      {/* Synchronized Cues List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scroll-smooth"
        role="region"
        aria-label={isAr ? "نص الدرس المتزامن" : "Transcription synchronisée"}
      >
        {filteredCues.map((cue) => {
          const isCurrent = effectiveTime >= cue.start && effectiveTime <= cue.end + 0.5;
          return (
            <div
              key={`${cue.start}-${cue.end}`}
              ref={isCurrent ? activeCueRef : undefined}
              onClick={() => handleSeek(cue.start)}
              className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer select-text ${
                isCurrent
                  ? "bg-[#F0F6FF] border-s-4 border-s-[#0056D2] text-[#0A192F] font-medium shadow-2xs"
                  : "hover:bg-slate-50 text-slate-700 border-s-4 border-s-transparent"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeek(cue.start);
                }}
                className={`flex-none font-mono text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                  isCurrent
                    ? "bg-[#0056D2] text-white font-bold"
                    : "bg-slate-100 text-slate-600 group-hover:bg-[#E2E8F0] group-hover:text-[#0056D2]"
                }`}
                aria-label={`${isAr ? "الانتقال إلى" : "Aller à"} ${formatSeconds(cue.start)}`}
              >
                <Play size={10} className={isCurrent ? "fill-white" : "group-hover:fill-[#0056D2]"} />
                <span dir="ltr">{formatSeconds(cue.start)}</span>
              </button>

              <p className="text-[13px] sm:text-sm leading-relaxed flex-1 mt-0.5">
                {cue.text}
              </p>
            </div>
          );
        })}

        {filteredCues.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">
            {isAr ? "لا توجد نتائج تطابق بحثك." : "Aucun résultat trouvé pour votre recherche."}
          </div>
        )}
      </div>
    </div>
  );
}
