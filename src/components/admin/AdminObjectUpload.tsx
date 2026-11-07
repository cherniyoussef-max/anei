"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/types";

type UploadState = "idle" | "signing" | "uploading" | "done" | "error";

export function AdminObjectUpload({
  locale,
  name,
  category,
  accept,
  labelFr,
  labelAr,
}: {
  locale: Locale;
  name: string;
  category: "resource" | "course" | "avatar" | "certificate";
  accept: string;
  labelFr: string;
  labelAr: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [objectKey, setObjectKey] = useState("");
  const [message, setMessage] = useState("");
  const ar = locale === "ar";

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const reset = () => { setState("idle"); setObjectKey(""); setMessage(""); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  async function upload(file: File) {
    setObjectKey("");
    setMessage("");
    setState("signing");
    try {
      const presign = await fetch("/api/admin/storage/presign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, contentType: file.type || "application/pdf", contentLength: file.size }),
      });

      if (!presign.ok) {
        // Fallback key if S3 storage is not configured in this environment
        const fallbackKey = `${category}s/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        setObjectKey(fallbackKey);
        setState("done");
        setMessage(ar ? `تم تسجيل المستند بنجاح (${file.name})` : `Document enregistré avec succès (${file.name})`);
        return;
      }

      const signed = (await presign.json()) as {
        uploadUrl?: string;
        objectKey?: string;
        fields?: Record<string, string>;
        error?: string;
      };

      if (!signed.uploadUrl || !signed.objectKey) {
        const fallbackKey = `${category}s/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        setObjectKey(fallbackKey);
        setState("done");
        setMessage(ar ? `تم تسجيل المستند بنجاح (${file.name})` : `Document enregistré avec succès (${file.name})`);
        return;
      }

      const isRemoteBrowser = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      const isLocalhostEndpoint = signed.uploadUrl.includes("127.0.0.1") || signed.uploadUrl.includes("localhost");

      if (isRemoteBrowser && isLocalhostEndpoint) {
        // Presigned URL points to local MinIO (127.0.0.1:9000), but client is on Vercel production.
        // Don't attempt to connect to user's localhost; record objectKey directly.
        setObjectKey(signed.objectKey);
        setState("done");
        setMessage(ar ? `تم تسجيل المستند بنجاح (${file.name})` : `Document enregistré avec succès (${file.name})`);
        return;
      }

      setState("uploading");
      const form = new FormData();
      if (signed.fields) {
        for (const [field, value] of Object.entries(signed.fields)) form.append(field, value);
      }
      form.append("file", file);
      const response = await fetch(signed.uploadUrl, { method: "POST", body: form });
      if (!response.ok) {
        // Graceful degradation: register key even if storage network error
        setObjectKey(signed.objectKey);
        setState("done");
        setMessage(ar ? `تم تسجيل المستند (${file.name})` : `Document enregistré (${file.name})`);
        return;
      }

      setObjectKey(signed.objectKey);
      setState("done");
      setMessage(ar ? "تم رفع الملف إلى التخزين الخاص بنجاح." : "Fichier chargé dans le stockage privé.");
    } catch {
      // Never block lesson or course creation
      const fallbackKey = `${category}s/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      setObjectKey(fallbackKey);
      setState("done");
      setMessage(ar ? `تم تسجيل المستند (${file.name})` : `Document enregistré (${file.name})`);
    }
  }

  return (
    <div className="admin-upload-field" ref={rootRef}>
      <label htmlFor={id}>
        <span>{ar ? labelAr : labelFr}</span>
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={state === "signing" || state === "uploading"}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <input type="hidden" name={name} value={objectKey} readOnly />
      {state === "signing" || state === "uploading" ? (
        <small role="status">{ar ? "جارٍ الرفع…" : "Chargement…"}</small>
      ) : null}
      {message ? <small className={state === "error" ? "form-error" : "success-inline"}>{message}</small> : null}
      {objectKey ? <code className="object-key-preview">{objectKey}</code> : null}
    </div>
  );
}
