"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function RewardRedeemButton({ locale, rewardId, affordable }: { locale: Locale; rewardId: string; affordable: boolean }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function redeem() {
    setState("loading");
    const res = await fetch(`/api/learning/rewards/${rewardId}/redeem`, { method: "POST" });
    if (res.ok) { router.refresh(); setState("idle"); } else setState("error");
  }

  return <div>
    <button type="button" className="btn btn-primary btn-sm" disabled={!affordable || state === "loading"} onClick={redeem}>
      {state === "loading" ? (ar ? "جارٍ الاستبدال..." : "Échange...") : (ar ? "استبدال" : "Échanger")}
    </button>
    {state === "error" ? <small className="form-error">{ar ? "تعذر الاستبدال." : "Échange impossible."}</small> : null}
  </div>;
}
