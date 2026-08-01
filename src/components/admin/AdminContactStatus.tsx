"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminContactStatus({id,status}:{id:string;status:string}){const router=useRouter();const[saving,setSaving]=useState(false);return <select aria-label="Statut du message" value={status} disabled={saving} onChange={async e=>{setSaving(true);await fetch(`/api/admin/contacts/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:e.target.value})});setSaving(false);router.refresh()}}><option value="new">new</option><option value="read">read</option><option value="closed">closed</option></select>}
