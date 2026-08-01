"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
export function WebinarRegisterButton({ webinarId, locale, replayUrl }: { webinarId:string; locale:Locale; replayUrl:string|null }) {
  const ar=locale==="ar"; const router=useRouter(); const [state,setState]=useState<"idle"|"loading"|"done"|"error">("idle");
  if (replayUrl) return <a className="btn btn-secondary" href={replayUrl} target="_blank" rel="noreferrer">{ar?"مشاهدة الإعادة":"Voir le replay"}</a>;
  async function register(){setState("loading"); const res=await fetch("/api/webinars/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({webinarId})}); if(res.status===401){router.push(`/${locale}/login?next=${encodeURIComponent(location.pathname)}`);return;} setState(res.ok?"done":"error");}
  return <button className="btn btn-secondary" type="button" onClick={register} disabled={state==="loading"||state==="done"}>{state==="done"?(ar?"تم التسجيل ✓":"Inscrit ✓"):state==="loading"?(ar?"جارٍ التسجيل...":"Inscription..."):(ar?"سجّل":"S’inscrire")}</button>;
}
