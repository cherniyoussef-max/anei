"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Volume2, Play, Pause, RotateCcw, Gauge } from "lucide-react";
import type { Locale } from "@/types";

export interface VoiceOverPlayerProps {
  locale: Locale;
  textAr: string;
  textFr: string;
  titleAr: string;
  titleFr: string;
}

export function InteractiveVoiceOverPlayer({
  locale,
  textAr,
  textFr,
  titleAr,
  titleFr,
}: VoiceOverPlayerProps) {
  const arDefault = locale === "ar";
  const [selectedLang, setSelectedLang] = useState<"ar" | "fr">(arDefault ? "ar" : "fr");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);

  const sentencesRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakSentenceRef = useRef<(index: number) => void>(() => {});

  const activeText = selectedLang === "ar" ? textAr : textFr;
  const isRTL = selectedLang === "ar";

  // Reset state during render if activeText changes (official React pattern)
  const [prevActiveText, setPrevActiveText] = useState(activeText);
  if (prevActiveText !== activeText) {
    setPrevActiveText(activeText);
    setProgress(0);
    setActiveSentenceIndex(-1);
    setIsPlaying(false);
    setIsPaused(false);
  }

  // Derive semantic sentences/paragraphs
  const sentences = useMemo(() => {
    const cleaned = activeText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const rawSentences = cleaned.split(/(?<=[.!?؟;؛\n])\s+/).filter((s) => s.trim().length > 0);
    return rawSentences.length > 0 ? rawSentences : [cleaned];
  }, [activeText]);

  // Keep refs in sync and cancel active speech on change or unmount
  useEffect(() => {
    sentencesRef.current = sentences;
    currentIndexRef.current = 0;
    isPlayingRef.current = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [sentences]);

  // Highlight DOM element matching current voice read target if available
  useEffect(() => {
    if (typeof document === "undefined") return;

    // Remove previous highlights
    document.querySelectorAll(".voice-highlight-active").forEach((el) => {
      el.classList.remove("voice-highlight-active", "bg-sky-50", "border-sky-400", "shadow-sm");
    });

    if (activeSentenceIndex >= 0) {
      const targetEl = document.querySelector(`[data-voice-idx="${activeSentenceIndex}"]`);
      if (targetEl) {
        targetEl.classList.add("voice-highlight-active", "bg-sky-50", "border-sky-400", "shadow-sm");
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeSentenceIndex]);

  const speakSentence = useCallback((index: number) => {
    if (!("speechSynthesis" in window) || index >= sentencesRef.current.length) {
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
      setActiveSentenceIndex(-1);
      setProgress(100);
      return;
    }

    const textToSpeak = sentencesRef.current[index];
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    // Configure language & voice
    utterance.lang = selectedLang === "ar" ? "ar-SA" : "fr-FR";
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Select preferred natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) =>
      selectedLang === "ar"
        ? v.lang.startsWith("ar")
        : v.lang.startsWith("fr") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Thomas") || v.name.includes("Julie"))
    ) || voices.find((v) => v.lang.startsWith(selectedLang));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setActiveSentenceIndex(index);
      const pct = Math.round(((index + 1) / sentencesRef.current.length) * 100);
      setProgress(pct);
    };

    utterance.onend = () => {
      if (isPlayingRef.current) {
        currentIndexRef.current = index + 1;
        speakSentenceRef.current(index + 1);
      }
    };

    utterance.onerror = (e) => {
      // Ignore canceled speech
      if (e.error !== "canceled") {
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [rate, selectedLang]);

  useEffect(() => {
    speakSentenceRef.current = speakSentence;
  }, [speakSentence]);

  const handlePlay = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlaying(true);
    setIsPaused(false);
    isPlayingRef.current = true;
    speakSentence(currentIndexRef.current);
  };

  const handlePause = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setIsPlaying(false);
    setIsPaused(true);
    isPlayingRef.current = false;
  };

  const handleReset = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    isPlayingRef.current = false;
    currentIndexRef.current = 0;
    setActiveSentenceIndex(-1);
    setProgress(0);
  };

  const handleSpeedChange = (newRate: number) => {
    setRate(newRate);
    if (isPlaying) {
      window.speechSynthesis.cancel();
      speakSentence(currentIndexRef.current);
    }
  };

  const toggleLang = (lang: "ar" | "fr") => {
    if (lang === selectedLang) return;
    handleReset();
    setSelectedLang(lang);
  };

  return (
    <div className="interactive-voice-over-player bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6 transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Title & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0056D2]/10 border border-[#0056D2]/20 flex items-center justify-center shrink-0 text-[#0056D2]">
            <Volume2 className={`w-5 h-5 ${isPlaying ? "animate-pulse text-[#0056D2]" : ""}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0056D2] bg-[#0056D2]/10 px-2 py-0.5 rounded-full">
                {isRTL ? "ميزة الدعم الصوتي التفاعلي" : "Voice-Over Interactif"}
              </span>
              {isPlaying && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {isRTL ? "قيد الاستماع" : "Lecture en cours"}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-[#0A192F] mt-0.5">
              {isRTL ? titleAr : titleFr}
            </h2>
          </div>
        </div>

        {/* Right: Language switch pills */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl self-stretch sm:self-auto justify-center">
          <button
            type="button"
            onClick={() => toggleLang("fr")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedLang === "fr"
                ? "bg-white text-[#0A192F] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🇫🇷 Français
          </button>
          <button
            type="button"
            onClick={() => toggleLang("ar")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all font-sans ${
              selectedLang === "ar"
                ? "bg-white text-[#0A192F] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🇸🇦 العربية
          </button>
        </div>
      </div>

      {/* Center: Controls Bar */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Play / Pause / Reset buttons */}
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <Pause size={15} />
              <span>{isRTL ? "إيقاف مؤقت" : "Pause"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0056D2] hover:bg-[#00419e] text-white text-xs font-bold transition-colors shadow-xs"
            >
              <Play size={15} className="fill-current" />
              <span>
                {isPaused
                  ? isRTL
                    ? "استئناف"
                    : "Reprendre"
                  : isRTL
                  ? "استمع إلى الدرس"
                  : "Écouter la leçon"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={!isPlaying && !isPaused && progress === 0}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title={isRTL ? "إعادة من البداية" : "Recommencer"}
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Gauge size={14} className="text-slate-400" />
          <span className="font-medium me-1">{isRTL ? "السرعة:" : "Vitesse:"}</span>
          {[0.85, 1, 1.25, 1.5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSpeedChange(s)}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                rate === s
                  ? "bg-[#0A192F] text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: Progress Bar */}
      <div className="mt-3">
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#0056D2] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
