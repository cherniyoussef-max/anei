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
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  useEffect(() => {
    let active = true;
    void authClient.listAccounts().then((result) => {
      if (!active) return;
      if (result.error || !result.data) setFailed(true);
      else setAccounts(result.data as AccountRow[]);
    });
    return () => { active = false; };
  }, []);

  async function linkGoogle() {
    if (linkingGoogle) return;
    setLinkingGoogle(true);
    const callbackURL = `/${locale}/dashboard/profil`;
    const result = await authClient.linkSocial({
      provider: "google",
      callbackURL,
      errorCallbackURL: `${callbackURL}?error=google_auth_failed`,
    });
    if (result.error) {
      setFailed(true);
      setLinkingGoogle(false);
    }
  }

  if (failed) return <p className="form-error">{ar ? "تعذر تحميل طرق تسجيل الدخول." : "Impossible de charger les méthodes de connexion."}</p>;
  const googleLinked = accounts.some((item) => item.providerId === "google");
  return <div className="connected-accounts">{accounts.map((item) => <div className="connected-account" key={item.id}><span className="provider-mark">{item.providerId === "google" ? <GoogleMark/> : "@"}</span><div><strong>{item.providerId === "credential" ? (ar ? "البريد وكلمة المرور" : "E-mail & mot de passe") : item.providerId === "google" ? "Google" : item.providerId}</strong><small>{ar ? "طريقة اتصال مرتبطة بالحساب" : "Méthode liée au compte"}</small></div></div>)}{!accounts.length ? <p className="small-muted">{ar ? "لا توجد طرق اتصال متاحة." : "Aucune méthode de connexion disponible."}</p> : null}{!googleLinked ? <button className="btn btn-google btn-block" type="button" onClick={linkGoogle} disabled={linkingGoogle}>{linkingGoogle ? (ar ? "جارٍ فتح Google..." : "Ouverture de Google…") : <><GoogleMark/>{ar ? "ربط حساب Google" : "Associer un compte Google"}</>}</button> : null}</div>;
}
