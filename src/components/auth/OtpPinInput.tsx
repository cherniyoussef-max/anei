"use client";

import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from "react";

interface OtpPinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  id?: string;
  ariaLabel?: string;
}

export function OtpPinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true,
  id = "auth-otp-input",
  ariaLabel = "Code de vérification",
}: OtpPinInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Array of 6 digits
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleInputChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const cleanNumbers = rawValue.replace(/\D/g, "");

    // If multiple characters typed or filled (e.g. Playwright .fill("123456") or browser autofill)
    if (cleanNumbers.length > 1) {
      const fullCode = cleanNumbers.slice(0, 6);
      onChange(fullCode);
      const targetIndex = Math.min(fullCode.length, 5);
      inputRefs.current[targetIndex]?.focus();
      if (fullCode.length === 6 && onComplete) {
        onComplete(fullCode);
      }
      return;
    }

    const cleanChar = cleanNumbers.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanChar;
    const newCode = newDigits.join("").slice(0, 6);
    onChange(newCode);

    if (cleanChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.length === 6 && onComplete) {
      onComplete(newCode);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index] = "";
        onChange(newDigits.join(""));
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    onChange(pasted);
    const targetIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetIndex]?.focus();

    if (pasted.length === 6 && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div
      className={`flex items-center justify-center gap-2 sm:gap-3 transition-transform ${
        hasError ? "animate-shake" : ""
      }`}
      role="group"
      aria-label={ariaLabel}
    >
      {/* First 3 digits */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {[0, 1, 2].map((i) => {
          const isCurrentActive = digits.slice(0, i).every((d) => d !== "") && digits[i] === "";
          return (
            <input
              key={i}
              id={i === 0 ? id : undefined}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              value={digits[i]}
              disabled={disabled}
              onChange={(e) => handleInputChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              aria-label={`Chiffre ${i + 1}`}
              className={`w-11 h-14 sm:w-12 sm:h-15 text-center text-2xl font-mono font-bold rounded-xl border transition-all shadow-2xs outline-hidden ${
                hasError
                  ? "border-red-400 bg-red-50/40 text-red-900 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                  : digits[i]
                  ? "border-[#082d55] bg-white text-[#082d55] shadow-xs"
                  : isCurrentActive
                  ? "border-[#0056D2] ring-2 ring-[#0056D2]/15 bg-white text-[#082d55]"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-800"
              }`}
            />
          );
        })}
      </div>

      {/* Center Divider Dot */}
      <div className="flex items-center justify-center px-1 text-slate-300 select-none font-bold text-lg" aria-hidden="true">
        •
      </div>

      {/* Last 3 digits */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {[3, 4, 5].map((i) => {
          const isCurrentActive = digits.slice(0, i).every((d) => d !== "") && digits[i] === "";
          return (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={digits[i]}
              disabled={disabled}
              onChange={(e) => handleInputChange(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              aria-label={`Chiffre ${i + 1}`}
              className={`w-11 h-14 sm:w-12 sm:h-15 text-center text-2xl font-mono font-bold rounded-xl border transition-all shadow-2xs outline-hidden ${
                hasError
                  ? "border-red-400 bg-red-50/40 text-red-900 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                  : digits[i]
                  ? "border-[#082d55] bg-white text-[#082d55] shadow-xs"
                  : isCurrentActive
                  ? "border-[#0056D2] ring-2 ring-[#0056D2]/15 bg-white text-[#082d55]"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-800"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
