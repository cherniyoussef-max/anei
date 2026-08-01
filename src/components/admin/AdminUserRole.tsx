"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminUserRole({ userId, role, canEdit }: { userId: string; role: string; canEdit: boolean }) {
  const router=useRouter(); const [saving,setSaving]=useState(false);
  if(!canEdit)return <span className={`table-status role-${role.toLowerCase()}`}>{role}</span>;
  return <select aria-label="Rôle utilisateur" value={role} disabled={saving} onChange={async e=>{setSaving(true);const next=e.target.value;const r=await fetch(`/api/admin/users/${userId}/role`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:next})});setSaving(false);if(r.ok)router.refresh();else router.refresh();}}><option value="USER">USER</option><option value="ADMIN">ADMIN</option><option value="SUPER_ADMIN">SUPER_ADMIN</option></select>;
}
