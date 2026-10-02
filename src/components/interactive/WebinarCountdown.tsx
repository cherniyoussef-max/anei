"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/types";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isLive: boolean;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const difference = targetDate.getTime() - Date.now();
  if (difference <= 0) {
    // If within 2 hours after start, consider it live!
    const isLive = difference > -2 * 3600 * 1000;
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: !isLive, isLive };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    isPast: false,
    isLive: false,
  };
}

export function WebinarCountdown({
  startsAt,
  locale,
}: {
  startsAt: string | Date;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const targetDate = useMemo(() => new Date(startsAt), [startsAt]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.isLive) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          background: "rgba(220, 38, 38, 0.1)",
          border: "1px solid rgba(220, 38, 38, 0.3)",
          borderRadius: "9999px",
          color: "#b91c1c",
          fontWeight: 700,
          fontSize: "0.9rem",
        }}
      >
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#dc2626",
            animation: "pulse 1.5s infinite",
          }}
        />
        {ar ? "البث المباشر جارٍ الآن !" : en ? "Live session is in progress!" : "En direct maintenant !"}
      </div>
    );
  }

  if (timeLeft.isPast) {
    return (
      <div
        style={{
          display: "inline-flex",
          padding: "0.4rem 0.85rem",
          background: "rgba(10, 37, 64, 0.05)",
          borderRadius: "9999px",
          color: "#64748b",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        {ar ? "انتهت الجلسة المباشرة" : en ? "Live session ended" : "Session terminée"}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
      }}
      aria-label="Compte à rebours avant le direct"
      dir="ltr"
    >
      {[
        { val: timeLeft.days, label: ar ? "يوم" : en ? "d" : "j" },
        { val: timeLeft.hours, label: ar ? "ساعة" : en ? "h" : "h" },
        { val: timeLeft.minutes, label: ar ? "دقيقة" : en ? "m" : "min" },
        { val: timeLeft.seconds, label: ar ? "ثانية" : en ? "s" : "s" },
      ].map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "48px",
            padding: "0.35rem 0.5rem",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#082d55", lineHeight: 1 }}>
            {String(item.val).padStart(2, "0")}
          </span>
          <span style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", marginTop: "2px" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
