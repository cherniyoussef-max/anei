"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/types";
import { GoogleMark } from "@/components/auth/GoogleMark";

type AccountRow = { id: string; providerId: string; createdAt?: Date | string };

export function ConnectedAccounts({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void authClient.listAccounts().then((result) => {
      if (!active) return;
      if (result.error || !result.data) setFailed(true);
      else setAccounts(result.data as AccountRow[]);
    });
    return () => { active = false; };
  }, []);
  if (failed) return <p className="form-error">{ar ? "تعذر تحميل طرق تسجيل الدخول." : "Impossible de charger les méthodes de connexion."}</p>;
  return <div className="connected-accounts">{accounts.map((item) => <div className="connected-account" key={item.id}><span className="provider-mark">{item.providerId === "google" ? <GoogleMark/> : "@"}</span><div><strong>{item.providerId === "credential" ? (ar ? "البريد وكلمة المرور" : "E-mail & mot de passe") : item.providerId === "google" ? "Google" : item.providerId}</strong><small>{ar ? "طريقة اتصال مرتبطة بالحساب" : "Méthode liée au compte"}</small></div></div>)}{!accounts.length ? <p className="small-muted">{ar ? "لا توجد طرق اتصال متاحة." : "Aucune méthode de connexion disponible."}</p> : null}</div>;
}
