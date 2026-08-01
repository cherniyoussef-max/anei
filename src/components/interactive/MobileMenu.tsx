"use client";
import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/types";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { authClient, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
export function MobileMenu({locale}:{locale:Locale}){const[open,setOpen]=useState(false);const c=t(locale);const{data}=useSession();const router=useRouter();const links=[["",c.nav.home],["about",c.nav.about],["formations",c.nav.courses],["webinaires",c.nav.webinars],["bibliotheque",c.nav.library],["avs",c.nav.avs],["actualites",c.nav.news],["contact",c.nav.contact]];async function logout(){await authClient.signOut();setOpen(false);router.push(`/${locale}`);router.refresh()}return <div className="mobile-menu-wrap"><button className="icon-button mobile-menu-button" type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Menu"><Icon name={open?"close":"menu"} size={22}/></button>{open?<div className="mobile-menu-panel"><nav>{links.map(([href,label])=><Link key={href} href={`/${locale}/${href}`} onClick={()=>setOpen(false)}>{label}</Link>)}</nav><div className="mobile-menu-actions">{data?.user?<><Link className="btn btn-primary" href={`/${locale}/dashboard`} onClick={()=>setOpen(false)}>{c.actions.dashboard}</Link><button className="btn btn-ghost" type="button" onClick={logout}>{locale==="ar"?"تسجيل الخروج":"Se déconnecter"}</button></>:<><Link className="btn btn-ghost" href={`/${locale}/login`} onClick={()=>setOpen(false)}>{c.actions.login}</Link><Link className="btn btn-primary" href={`/${locale}/register`} onClick={()=>setOpen(false)}>{c.actions.register}</Link></>}</div></div>:null}</div>}
