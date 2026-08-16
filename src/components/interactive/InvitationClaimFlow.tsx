"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

type Landing = { organizationName: string; maskedPhone: string; status: string };

export function InvitationClaimFlow({ token, locale }: { token: string; locale: string }) {
  const ar = locale === "ar";
  const { data: session, isPending: sessionPending } = useSession();
  const [landing, setLanding] = useState<Landing | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invitation/status?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => !cancelled && setLanding(data))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function requestOtp() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/invitation/otp/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    setBusy(false);
    if (res.ok) {
      setOtpRequested(true);
      setMessage(ar ? "تم إرسال رمز التحقق عبر واتساب." : "Un code de vérification a été envoyé par WhatsApp.");
    } else {
      setMessage(ar ? "تعذر إرسال الرمز. حاول لاحقًا." : "Impossible d’envoyer le code. Réessayez plus tard.");
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/invitation/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, code }) });
    setBusy(false);
    if (res.ok) {
      setLanding((prev) => (prev ? { ...prev, status: "VERIFIED" } : prev));
      setMessage(ar ? "تم التحقق من رقم هاتفك." : "Votre numéro a été vérifié.");
    } else {
      setMessage(ar ? "رمز غير صحيح أو منتهي الصلاحية." : "Code invalide ou expiré.");
    }
  }

  async function claim() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/invitation/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    setBusy(false);
    if (res.ok) {
      setClaimed(true);
    } else {
      setMessage(ar ? "تعذر ربط الحساب." : "Impossible de relier le compte.");
    }
  }

  if (loadError) return <p>{ar ? "رابط الدعوة غير صالح أو منتهي الصلاحية." : "Ce lien d’invitation est invalide ou a expiré."}</p>;
  if (!landing) return <p>{ar ? "جارٍ التحميل..." : "Chargement..."}</p>;

  if (claimed) return <p>{ar ? "تم ربط حسابك بنجاح." : "Votre compte a bien été relié."}</p>;

  if (["REVOKED", "EXPIRED", "CONSUMED"].includes(landing.status)) {
    return <p>{ar ? "هذه الدعوة لم تعد صالحة." : "Cette invitation n’est plus valide."}</p>;
  }

  const nextParam = encodeURIComponent(`/${locale}/invitation/${token}`);

  return (
    <div className="auth-card">
      <p>{ar ? `دعوة من ${landing.organizationName} للهاتف ${landing.maskedPhone}` : `Invitation de ${landing.organizationName} pour le téléphone ${landing.maskedPhone}`}</p>

      {landing.status !== "VERIFIED" ? (
        <>
          {!otpRequested ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={requestOtp}>
              {ar ? "إرسال رمز التحقق" : "Envoyer le code de vérification"}
            </button>
          ) : (
            <>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={ar ? "الرمز المكوّن من 6 أرقام" : "Code à 6 chiffres"} />
              <button type="button" className="btn btn-primary" disabled={busy || code.length !== 6} onClick={verifyOtp}>
                {ar ? "تحقق" : "Vérifier"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={requestOtp}>
                {ar ? "إعادة إرسال الرمز" : "Renvoyer le code"}
              </button>
            </>
          )}
        </>
      ) : sessionPending ? (
        <p>{ar ? "جارٍ التحقق من الجلسة..." : "Vérification de la session..."}</p>
      ) : session ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={claim}>
          {ar ? "ربط حسابي" : "Relier mon compte"}
        </button>
      ) : (
        <div className="auth-switch">
          <Link href={`/${locale}/login?next=${nextParam}`} className="btn btn-primary">
            {ar ? "لدي حساب بالفعل" : "J’ai déjà un compte"}
          </Link>
          <Link href={`/${locale}/register?next=${nextParam}`} className="btn btn-ghost">
            {ar ? "إنشاء حساب جديد" : "Créer mon compte"}
          </Link>
        </div>
      )}

      {message ? <p className="admin-error">{message}</p> : null}
    </div>
  );
}
