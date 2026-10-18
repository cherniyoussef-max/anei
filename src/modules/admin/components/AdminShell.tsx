"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AneiLogo } from "@/components/brand/AneiLogo";
import type { Locale } from "@/types";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  MessageSquare,
  Instagram,
  MessageCircle,
  BookOpen,
  FileEdit,
  GraduationCap,
  BarChart3,
  Award,
  Video,
  CalendarDays,
  FolderDown,
  ShoppingBag,
  CreditCard,
  Mail,
  Newspaper,
  ShieldCheck,
  Stethoscope,
  Activity,
  FileText,
  Search,
  ChevronsUpDown,
  ChevronRight,
  Sparkles,
  Globe,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: ComponentType<{ className?: string }>;
  fr: string;
  ar: string;
  badge?: string;
}

interface NavGroup {
  fr: string;
  ar: string;
  items: NavItem[];
}

export function AdminShell({
  children,
  locale,
  user,
}: {
  children: React.ReactNode;
  locale: Locale;
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ar = locale === "ar";
  const base = `/${locale}/admin`;

  const groups: NavGroup[] = useMemo(() => [
    {
      fr: "Pilotage",
      ar: "القيادة والتنفيذ",
      items: [
        { href: base, icon: LayoutDashboard, fr: "Vue d’ensemble", ar: "نظرة عامة" },
        { href: `${base}/marketing`, icon: TrendingUp, fr: "Marketing & Audience", ar: "التسويق والجمهور" },
        { href: `${base}/users`, icon: Users, fr: "Utilisateurs", ar: "المستخدمون" },
      ],
    },
    {
      fr: "Apprentissage",
      ar: "منظومة التعلّم",
      items: [
        { href: `${base}/courses`, icon: BookOpen, fr: "Formations", ar: "الدورات" },
        { href: `${base}/courses/editor`, icon: FileEdit, fr: "Éditeur de cours", ar: "محرر الدورات" },
        { href: `${base}/enrollments`, icon: GraduationCap, fr: "Inscriptions", ar: "التسجيلات" },
        { href: `${base}/assessments`, icon: BarChart3, fr: "Évaluations & résultats", ar: "التقييمات والنتائج" },
        { href: `${base}/certificates`, icon: Award, fr: "Certificats", ar: "الشهادات" },
        { href: `${base}/live`, icon: Video, fr: "Directs & Webinaires", ar: "البث المباشر والندوات" },
        { href: `${base}/disponibilites`, icon: CalendarDays, fr: "Disponibilités", ar: "الفتحات المتاحة" },
        { href: `${base}/resources`, icon: FolderDown, fr: "Bibliothèque", ar: "المكتبة" },
      ],
    },
    {
      fr: "Messagerie & CRM",
      ar: "إدارة علاقات العملاء",
      items: [
        { href: `${base}/crm/whatsapp`, icon: MessageSquare, fr: "WhatsApp CRM", ar: "واتساب CRM" },
        { href: `${base}/crm/instagram`, icon: Instagram, fr: "Instagram CRM", ar: "إنستغرام CRM" },
        { href: `${base}/crm/messenger`, icon: MessageCircle, fr: "Messenger CRM", ar: "ماسنجر CRM" },
      ],
    },
    {
      fr: "Annuaires & Opérations",
      ar: "العمليات والأدلة",
      items: [
        { href: `${base}/orders`, icon: ShoppingBag, fr: "Commandes", ar: "الطلبات" },
        { href: `${base}/payments`, icon: CreditCard, fr: "Paiements", ar: "المدفوعات" },
        { href: `${base}/contacts`, icon: Mail, fr: "Messages & Contacts", ar: "الرسائل والتواصل" },
        { href: `${base}/news`, icon: Newspaper, fr: "Actualités", ar: "الأخبار" },
        { href: `${base}/avs`, icon: ShieldCheck, fr: "Annuaire & RDV AVS", ar: "دليل ومواعيد المرافقين" },
        { href: `${base}/care`, icon: Stethoscope, fr: "Suivis spécialistes", ar: "متابعات المختصين" },
      ],
    },
    {
      fr: "Gouvernance",
      ar: "الحوكمة والنظام",
      items: [
        { href: `${base}/system`, icon: Activity, fr: "État du système", ar: "حالة النظام" },
        { href: `${base}/audit`, icon: FileText, fr: "Journal d’audit", ar: "سجل العمليات" },
      ],
    },
  ], [base]);

  // Determine active item based on current pathname
  const activeHref = useMemo(() => {
    return groups
      .flatMap((group) => group.items)
      .filter((item) => (item.href === base ? pathname === base : pathname === item.href || pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [groups, pathname, base]);

  const activeGroup = useMemo(() => {
    return groups.find((group) => group.items.some((item) => item.href === activeHref));
  }, [groups, activeHref]);

  const activeItem = useMemo(() => {
    return activeGroup?.items.find((item) => item.href === activeHref);
  }, [activeGroup, activeHref]);

  // Quick search filter for sidebar navigation
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) => item.fr.toLowerCase().includes(q) || item.ar.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, searchQuery]);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const sidebarInner = (
    <div className="h-full flex flex-col min-h-0">
      {/* 1. Top Account Switcher */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200/80 bg-white/70 shrink-0">
        <Link href={base} className="flex items-center gap-2.5 min-w-0 flex-1 group">
          <AneiLogo locale={locale} variant="mark" withText={false} height={26} priority />
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[13px] font-semibold text-[#0A192F] truncate group-hover:text-[#0056D2] transition-colors">
              ANEI Console
            </span>
            <span className="text-[10.5px] text-slate-400 truncate">
              {user.email || "admin@anei.tn"}
            </span>
          </div>
        </Link>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ms-1" />
      </div>

      {/* 2. Quick Search (Ctrl+K) */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="w-full h-8 px-2.5 rounded-md border border-slate-200/90 bg-white flex items-center gap-1.5 shadow-2xs hover:border-slate-300 focus-within:border-[#0056D2] focus-within:ring-1 focus-within:ring-[#0056D2]/20 transition-all">
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ar ? "بحث سريع..." : "Recherche rapide..."}
            className="admin-search-input flex-1 min-w-0 text-[12.5px] text-[#0A192F] placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={ar ? "مسح البحث" : "Effacer la recherche"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200/90 px-1.5 py-0.5 rounded shrink-0 select-none">
              Ctrl K
            </kbd>
          )}
        </div>
      </div>

      {/* 3. Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 min-h-0" aria-label={ar ? "التنقل الإداري" : "Navigation d’administration"}>
        {filteredGroups.map((group) => (
          <div key={group.fr}>
            <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-slate-400 tracking-normal select-none">
              {ar ? group.ar : group.fr}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                const IconComponent = item.icon;
                const label = ar ? item.ar : item.fr;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      active
                        ? "bg-slate-200/75 text-[#0A192F] font-semibold"
                        : "text-slate-600 font-normal hover:bg-slate-200/40 hover:text-[#0A192F]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComponent
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-[#0A192F] stroke-[1.8]" : "text-slate-500 stroke-[1.6] group-hover:text-[#0A192F]"
                        }`}
                      />
                      <span className="truncate">{label}</span>
                    </div>

                    {item.badge ? (
                      <span className="rounded bg-slate-200/80 px-1.5 py-0.2 text-[10.5px] font-medium text-slate-600 shrink-0">
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180 group-hover:text-slate-600 shrink-0 transition-transform" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 4. Bottom Profile Card */}
      <div className="p-3 border-t border-slate-200/80 bg-white/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#0A192F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            {user.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[12.5px] font-semibold text-[#0A192F] truncate">{user.name}</span>
            <span className="text-[10px] text-slate-400 uppercase font-medium truncate">{user.role}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={ar ? "rtl" : "ltr"}>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 z-30 w-64 h-screen bg-slate-50/95 border-e border-slate-200 flex-col select-none">
        {sidebarInner}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[85vw] bg-slate-50 h-full z-10 shadow-2xl flex flex-col">
            <div className="absolute top-3 end-3 z-20">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-md text-slate-500 hover:bg-slate-100"
                aria-label={ar ? "إغلاق القائمة" : "Fermer le menu"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarInner}
          </div>
        </div>
      )}

      {/* Main Column offset by sidebar width on desktop */}
      <div className="lg:ps-64 flex flex-col min-h-screen min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between select-none">
          {/* Left: Hamburger (mobile) + Breadcrumbs */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 -ms-1.5 rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none"
              aria-label={ar ? "فتح القائمة" : "Ouvrir le menu"}
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav className="flex items-center gap-1.5 text-[13px] min-w-0" aria-label={ar ? "مسار التنقل" : "Fil d’Ariane"}>
              <Link href={base} className="text-slate-500 hover:text-[#0A192F] transition-colors shrink-0">
                {ar ? "الإدارة" : "Administration"}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180 shrink-0" />
              {activeGroup && (
                <>
                  <span className="text-slate-500 hidden sm:inline truncate">
                    {ar ? activeGroup.ar : activeGroup.fr}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180 shrink-0 hidden sm:inline" />
                </>
              )}
              <span className="font-semibold text-[#0A192F] truncate">
                {activeItem ? (ar ? activeItem.ar : activeItem.fr) : (ar ? "لوحة القيادة" : "Tableau de bord")}
              </span>
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Assistant IA */}
            <Link
              href={`${base}/system`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700 hover:text-[#0056D2] px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#0056D2]" />
              <span className="hidden sm:inline">{ar ? "المساعد الذكي" : "Assistant IA"}</span>
            </Link>

            {/* Platform Exit */}
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-[#0A192F] px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
              title={ar ? "العودة إلى المنصة" : "Retour à la plateforme"}
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{ar ? "المنصة" : "Plateforme"}</span>
            </Link>

            {/* Language Switcher */}
            <Link
              href={`/${ar ? "fr" : "ar"}${pathname.replace(/^\/(fr|ar)/, "")}`}
              hrefLang={ar ? "fr" : "ar"}
              className="text-[12px] font-bold text-slate-700 hover:text-[#0056D2] px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              {ar ? "FR" : "العربية"}
            </Link>

            {/* Admin Avatar */}
            <div className="flex items-center gap-2 ps-2 border-s border-slate-200">
              <div className="w-7 h-7 rounded-full bg-[#0A192F] text-white text-[11px] font-bold flex items-center justify-center">
                {user.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
              </div>
              <span className="text-[12.5px] font-semibold text-[#0A192F] hidden xl:inline">
                {user.name}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-7xl w-full mx-auto" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
