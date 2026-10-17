"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/types";

interface AdminSudoModalProps {
  isOpen: boolean;
  locale: Locale;
  actionTitle?: string;
  actionDescription?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminSudoModal({
  isOpen,
  locale,
  actionTitle,
  actionDescription,
  onSuccess,
  onCancel,
}: AdminSudoModalProps) {
  const ar = locale === "ar";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/sudo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error === "RATE_LIMITED"
            ? (ar ? "محاولات كثيرة جدًا. انتظر قليلاً." : "Trop de tentatives. Veuillez patienter.")
            : (ar ? "كلمة المرور غير صحيحة." : "Mot de passe administrateur incorrect.")
        );
        return;
      }

      onSuccess();
    } catch {
      setError(ar ? "خطأ في الاتصال بالخادم." : "Erreur de communication avec le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sudo-modal-title"
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 14,
          maxWidth: 440,
          width: "100%",
          padding: 24,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e2e8f0",
          direction: ar ? "rtl" : "ltr",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#fef3c7",
              color: "#b45309",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h3 id="sudo-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              {actionTitle || (ar ? "تأكيد وضع Sudo المطلوب" : "Confirmation requise (Mode Sudo)")}
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {ar ? "حماية العمليات الحساسة" : "Sécurité renforcée des opérations critiques"}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#334155", margin: "0 0 16px", lineHeight: 1.5 }}>
          {actionDescription ||
            (ar
              ? "هذا الإجراء محمي بوضع Sudo. يرجى تأكيد كلمة مرور المشرف للمتابعة. ستظل الجلسة موثوقة لمدة 15 دقيقة."
              : "Cette action hautement privilégiée nécessite une confirmation. Veuillez saisir votre mot de passe pour continuer. La session restera vérifiée pendant 15 minutes.")}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="admin-sudo-input"
              style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}
            >
              {ar ? "كلمة مرور المشرف (Admin)" : "Mot de passe administrateur"}
            </label>
            <input
              id="admin-sudo-input"
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
                background: "#f8fafc",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "8px 12px",
                borderRadius: 6,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {ar ? "إلغاء" : "Annuler"}
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="admin-primary-button"
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "#082D55",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: loading || !password ? "not-allowed" : "pointer",
                opacity: loading || !password ? 0.7 : 1,
              }}
            >
              {loading ? (ar ? "جارٍ التحقق..." : "Vérification...") : ar ? "تأكيد ومتابعة" : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
