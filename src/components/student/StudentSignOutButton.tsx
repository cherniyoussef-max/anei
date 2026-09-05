"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Locale } from "@/types";
import { authClient } from "@/lib/auth-client";

export function StudentSignOutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ar = locale === "ar";
  const en = locale === "en";
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function signOut() {
    if (state === "loading") return;
    setState("loading");
    const result = await authClient.signOut();
    if (result.error) {
      setState("error");
      return;
    }
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <div className="student-signout-wrap">
      <button className="student-signout" type="button" onClick={signOut} disabled={state === "loading"} aria-busy={state === "loading"}>
        <LogOut size={17} strokeWidth={1.75} />
        <span>{state === "loading" ? (ar ? "جارٍ الخروج..." : en ? "Signing out..." : "Déconnexion...") : (ar ? "تسجيل الخروج" : en ? "Sign out" : "Se déconnecter")}</span>
      </button>
      {state === "error" ? <small role="alert">{ar ? "تعذر تسجيل الخروج. حاول مجددًا." : en ? "Unable to sign out. Try again." : "Déconnexion impossible. Réessayez."}</small> : null}
    </div>
  );
}
