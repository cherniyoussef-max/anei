import { redirect } from "next/navigation";
export default async function LegacyUsers({ params, searchParams }: { params: Promise<{locale:string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const {locale}=await params; const query=await searchParams; const values=new URLSearchParams();
  for(const [key,value] of Object.entries(query)) if(typeof value==="string") values.set(key,value);
  redirect(`/${locale}/admin/users${values.size?`?${values}`:""}`);
}
