"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

/**
 * Authenticated claim action. The page guarantees a session before rendering
 * this; the user id used by the server comes from the session, never from the
 * browser. Idempotent for the same user; success routes to the STUDENT portal.
 */
export function InvitationClaimForm({ token, locale }: { token: string; locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        router.push(`/${locale}/dashboard`);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.error === "EXPIRED") {
        setError(ar ? "انتهت صلاحية هذه الدعوة." : "Cette invitation a expiré.");
      } else if (data?.error === "CLAIM_CONFLICT") {
        setError(ar ? "هذه الدعوة مرتبطة بحساب آخر." : "Cette invitation est déjà liée à un autre compte.");
      } else {
        setError(ar ? "تعذر ربط حسابك. حاول مجددًا." : "Impossible de lier votre compte. Réessayez.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary btn-block" onClick={claim} disabled={busy}>
        {busy ? (ar ? "جارٍ الربط..." : "Liaison…") : (ar ? "ربط حسابي" : "Lier mon compte")}
      </button>
    </>
  );
}