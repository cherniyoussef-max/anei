"use client";

import { useMemo } from "react";
import type { Locale } from "@/types";
import { InteractiveVoiceOverPlayer } from "./InteractiveVoiceOverPlayer";
import {
  FirstThenBoardSimulator,
  AbcBehaviorAnalyzer,
  PromptFadingSlider,
  TeacherChecklistInteractive,
  InterventionMatrixFilter,
} from "./autism";

interface AutismLessonInteractiveContentProps {
  courseSlug: string;
  lessonPosition: number;
  locale: Locale;
  titleFr: string;
  titleAr: string;
  descriptionFr: string;
  descriptionAr: string;
}

export function AutismLessonInteractiveContent({
  courseSlug,
  lessonPosition,
  locale,
  titleFr,
  titleAr,
  descriptionFr,
  descriptionAr,
}: AutismLessonInteractiveContentProps) {
  const isAr = locale === "ar";
  const activeText = isAr ? descriptionAr : descriptionFr;

  // Split description text into sentences/paragraphs with data-voice-idx
  const paragraphs = useMemo(() => {
    if (!activeText) return [];
    return activeText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [activeText]);

  const isAutismCourse = courseSlug === "trouble-spectre-autisme-accompagnement-scolaire";

  return (
    <div className="mt-6 space-y-6">
      {/* 1. Voice-Over Player */}
      <InteractiveVoiceOverPlayer
        locale={locale}
        textAr={descriptionAr || titleAr}
        textFr={descriptionFr || titleFr}
        titleAr={titleAr}
        titleFr={titleFr}
      />

      {/* 2. Structured Lesson Text with Karaoke Highlight Anchors */}
      <div className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs">
        {paragraphs.map((paragraph, idx) => {
          // Check if paragraph is a heading or bullet list
          if (paragraph.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-lg font-bold text-slate-900 mt-6 mb-2 border-b border-slate-100 pb-2">
                {paragraph.replace("### ", "")}
              </h3>
            );
          }
          if (paragraph.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-xl font-extrabold text-[#0A192F] mt-7 mb-3 border-b border-slate-200 pb-2">
                {paragraph.replace("## ", "")}
              </h2>
            );
          }
          if (paragraph.startsWith("- ")) {
            const items = paragraph.split(/\n-\s*/).map((s) => s.replace(/^- /, "").trim()).filter(Boolean);
            return (
              <ul key={idx} className="list-disc list-inside space-y-1.5 my-3 text-slate-700">
                {items.map((item, itemIdx) => (
                  <li key={itemIdx} data-voice-idx={`${idx}-${itemIdx}`} className="p-1 rounded transition-colors">
                    {item}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p
              key={idx}
              data-voice-idx={idx}
              className="my-3 p-1.5 rounded-lg transition-colors leading-relaxed"
            >
              {paragraph}
            </p>
          );
        })}
      </div>

      {/* 3. Conditional Interactive Simulator based on Lesson Position */}
      {isAutismCourse && (
        <div className="mt-8">
          {/* Lesson 2: EBP Intervention Matrix */}
          {lessonPosition === 2 && (
            <InterventionMatrixFilter locale={locale} />
          )}

          {/* Lesson 4: Teacher & AVS Checklist */}
          {lessonPosition === 4 && (
            <TeacherChecklistInteractive locale={locale} />
          )}

          {/* Lesson 6: Prompt Fading Slider */}
          {lessonPosition === 6 && (
            <PromptFadingSlider locale={locale} />
          )}

          {/* Lesson 7: First-Then Board */}
          {lessonPosition === 7 && (
            <FirstThenBoardSimulator locale={locale} />
          )}

          {/* Lesson 8: ABC Functional Behavior Analysis */}
          {lessonPosition === 8 && (
            <AbcBehaviorAnalyzer locale={locale} />
          )}
        </div>
      )}
    </div>
  );
}
