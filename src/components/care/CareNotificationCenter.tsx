"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  FileText,
  Users,
  Calendar,
  ExternalLink,
  Settings,
} from "lucide-react";
import type { Locale } from "@/types";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export function CareNotificationCenter({
  locale,
  preferencesHref,
  variant = "dark",
}: {
  locale: Locale;
  preferencesHref?: string;
  variant?: "dark" | "light";
}) {
  const ar = locale === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/care/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
        setNotifications(data.items ?? []);
      }
    } catch {
      // Background poll failure is non-blocking
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/care/notifications?limit=20");
        if (res.ok && active) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
          setNotifications(data.items ?? []);
        }
      } catch {
        // non-blocking
      }
    }
    void load();
    const interval = setInterval(load, 45_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleMarkAllAsRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/care/notifications/read-all", { method: "POST" });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {
      // Non-blocking
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      await fetch(`/api/care/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Non-blocking
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "CARE_MESSAGE_RECEIVED":
        return <MessageSquare className="h-4 w-4 text-[#082D55]" />;
      case "CARE_NOTE_SHARED":
      case "CARE_NOTE_ADDENDUM":
      case "CARE_DOCUMENT_SHARED":
        return <FileText className="h-4 w-4 text-[#a9752f]" />;
      case "CARE_REQUEST_RECEIVED":
      case "CARE_REQUEST_ACCEPTED":
      case "CARE_REQUEST_DECLINED":
      case "CARE_RELATIONSHIP_ENDED":
        return <Users className="h-4 w-4 text-[#166534]" />;
      default:
        return <Calendar className="h-4 w-4 text-[#082D55]" />;
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#C9913F] ${
          variant === "light"
            ? "border border-[#e2d7c3] bg-white text-[#082D55] hover:bg-[#FAF7F2] shadow-sm"
            : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
        }`}
        aria-label={ar ? "مركز الإشعارات" : "Centre de notifications"}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e11d48] px-1 text-[11px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          dir={ar ? "rtl" : "ltr"}
          className="absolute end-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#e2d7c3] bg-white p-0 shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e2d7c3]/60 bg-[#FAF7F2] px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-[#082D55]">
                {ar ? "الإشعارات" : "Notifications"}
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#082D55]/10 px-2 py-0.5 text-[11px] font-medium text-[#082D55]">
                  {unreadCount} {ar ? "جديد" : "non lue(s)"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#a9752f] hover:bg-[#a9752f]/10 transition-colors"
                  title={ar ? "تحديد الكل كمقروء" : "Tout marquer comme lu"}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {ar ? "قراءة الكل" : "Tout lire"}
                  </span>
                </button>
              )}
              {preferencesHref && (
                <Link
                  href={preferencesHref}
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-[#7a7261] hover:bg-[#e2d7c3]/40 hover:text-[#082D55] transition-colors"
                  title={ar ? "تفضيلات الإشعارات" : "Préférences"}
                >
                  <Settings className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#e2d7c3]/40">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-[#7a7261]/30" />
                <p className="mt-2 text-xs font-medium text-[#7a7261]">
                  {ar ? "لا توجد إشعارات حالياً" : "Aucune notification pour le moment"}
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 transition-colors ${
                    item.read
                      ? "bg-white hover:bg-[#FAF7F2]/60"
                      : "bg-[#082D55]/[0.03] hover:bg-[#082D55]/[0.06]"
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-[#FAF7F2] border border-[#e2d7c3]">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          item.read
                            ? "font-medium text-[#334155]"
                            : "font-semibold text-[#082D55]"
                        }`}
                      >
                        {item.title}
                      </h4>
                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(item.id)}
                          className="text-[#7a7261] hover:text-[#082D55] p-0.5"
                          title={ar ? "تعليم كمقروء" : "Marquer comme lu"}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#64748b] line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                    {item.href && (
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (!item.read) handleMarkAsRead(item.id);
                          setIsOpen(false);
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#a9752f] hover:underline"
                      >
                        <span>{ar ? "فتح" : "Ouvrir"}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
