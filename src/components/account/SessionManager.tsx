"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/types";

type SessionRow = {
  token: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function deviceLabel(userAgent: string | null | undefined, ar: boolean) {
  if (!userAgent) return ar ? "جهاز غير معروف" : "Appareil inconnu";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)
          ? "Safari"
          : ar
            ? "متصفح"
            : "Navigateur";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS/iPadOS"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export function SessionManager({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const current = authClient.useSession();
  const currentToken = current.data?.session.token;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-TN", { dateStyle: "medium", timeStyle: "short" }),
    [ar],
  );

  const refresh = useCallback(async () => {
    setState("loading");
    const result = await authClient.listSessions();
    if (result.error || !result.data) {
      setState("error");
      return;
    }
    setSessions(result.data as SessionRow[]);
    setState("ready");
  }, []);

  useEffect(() => {
    let active = true;
    void authClient.listSessions().then((result) => {
      if (!active) return;
      if (result.error || !result.data) {
        setState("error");
        return;
      }
      setSessions(result.data as SessionRow[]);
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  async function revoke(token: string) {
    setBusy(token);
    const result = await authClient.revokeSession({ token });
    setBusy(null);
    if (!result.error) await refresh();
  }

  async function revokeOthers() {
    setBusy("others");
    const result = await authClient.revokeOtherSessions();
    setBusy(null);
    if (!result.error) await refresh();
  }

  if (state === "loading") return <p className="small-muted">{ar ? "تحميل الجلسات..." : "Chargement des sessions…"}</p>;
  if (state === "error") return <p className="form-error">{ar ? "تعذر تحميل الجلسات." : "Impossible de charger les sessions."}</p>;

  return (
    <div className="session-manager">
      <div className="session-manager-head">
        <p className="small-muted">
          {ar
            ? "راجع الأجهزة التي تستخدم حسابك وأغلق أي جلسة لا تتعرف عليها."
            : "Contrôlez les appareils connectés et révoquez toute session que vous ne reconnaissez pas."}
        </p>
        {sessions.length > 1 ? (
          <button className="btn btn-ghost" type="button" disabled={busy !== null} onClick={revokeOthers}>
            {busy === "others" ? (ar ? "جارٍ الإغلاق..." : "Révocation…") : ar ? "إغلاق الجلسات الأخرى" : "Révoquer les autres"}
          </button>
        ) : null}
      </div>
      <div className="session-list">
        {sessions.map((item) => {
          const isCurrent = Boolean(currentToken && item.token === currentToken);
          return (
            <article className="session-item" key={item.token}>
              <div>
                <div className="session-title-row">
                  <strong>{deviceLabel(item.userAgent, ar)}</strong>
                  {isCurrent ? <span className="status-chip success">{ar ? "هذه الجلسة" : "Session actuelle"}</span> : null}
                </div>
                <small>
                  {ar ? "آخر نشاط" : "Dernière activité"} · {formatter.format(new Date(item.updatedAt))}
                  {item.ipAddress ? ` · ${item.ipAddress}` : ""}
                </small>
              </div>
              {!isCurrent ? (
                <button className="btn btn-ghost danger-text" type="button" disabled={busy !== null} onClick={() => revoke(item.token)}>
                  {busy === item.token ? (ar ? "جارٍ الإغلاق..." : "Révocation…") : ar ? "إغلاق" : "Révoquer"}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
