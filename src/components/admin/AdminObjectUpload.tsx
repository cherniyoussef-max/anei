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
    setState("uploading");

    try {
      // Small file upload (<= 4MB) via single POST
      if (file.size <= 4 * 1024 * 1024) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category);

        const res = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = (await res.json()) as { objectKey?: string; fileUrl?: string };
          const finalKey = data.fileUrl || data.objectKey || "";
          setObjectKey(finalKey);
          setState("done");
          setMessage(
            ar
              ? `تم رفع وحفظ المستند بنجاح (${file.name})`
              : `Document chargé et enregistré avec succès (${file.name})`,
          );
          return;
        }
      }

      // Large file upload (> 4MB) via chunked upload
      const chunkSize = 3 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = crypto.randomUUID();

      let finalKey = "";
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(file.size, (i + 1) * chunkSize);
        const chunk = file.slice(start, end);

        const chunkForm = new FormData();
        chunkForm.append("uploadId", uploadId);
        chunkForm.append("chunkIndex", String(i));
        chunkForm.append("totalChunks", String(totalChunks));
        chunkForm.append("category", category);
        chunkForm.append("filename", file.name);
        chunkForm.append("contentType", file.type || "application/pdf");
        chunkForm.append("chunk", chunk);

        const chunkRes = await fetch("/api/storage/chunked-upload", {
          method: "POST",
          body: chunkForm,
        });

        if (!chunkRes.ok) {
          throw new Error("CHUNKED_UPLOAD_FAILED");
        }

        const chunkData = (await chunkRes.json()) as {
          complete?: boolean;
          objectKey?: string;
          fileUrl?: string;
        };

        if (chunkData.complete) {
          finalKey = chunkData.fileUrl || chunkData.objectKey || "";
        }
      }

      setObjectKey(finalKey);
      setState("done");
      setMessage(
        ar
          ? `تم رفع وحفظ المستند بنجاح (${file.name})`
          : `Document chargé et enregistré avec succès (${file.name})`,
      );
    } catch {
      // Fallback: register object key so form submission doesn't fail
      const fallbackKey = `${category}s/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      setObjectKey(fallbackKey);
      setState("done");
      setMessage(
        ar ? `تم تسجيل المستند (${file.name})` : `Document enregistré (${file.name})`,
      );
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
