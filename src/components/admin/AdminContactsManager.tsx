"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

export type ContactMessageItem = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: Date | string;
};

export type AdminContactsManagerProps = {
  locale: Locale;
  initialMessages: ContactMessageItem[];
};

export function AdminContactsManager({ locale, initialMessages }: AdminContactsManagerProps) {
  const ar = locale === "ar";
  const [messages, setMessages] = useState<ContactMessageItem[]>(initialMessages);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "new" | "read" | "closed">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Filter messages
  const filtered = messages.filter((m) => {
    if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchEmail = m.email.toLowerCase().includes(q);
      const matchSubject = m.subject.toLowerCase().includes(q);
      const matchBody = m.message.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchSubject && !matchBody) return false;
    }
    return true;
  });

  const countNew = messages.filter((m) => m.status === "new").length;
  const countRead = messages.filter((m) => m.status === "read").length;
  const countClosed = messages.filter((m) => m.status === "closed").length;

  async function updateStatus(id: string, newStatus: "new" | "read" | "closed") {
    setIsUpdating(id);
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
        );
        if (selectedMessage?.id === id) {
          setSelectedMessage((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(null);
    }
  }

  async function deleteMessage(id: string) {
    if (!confirm(ar ? "هل أنت متأكد من حذف هذه الرسالة؟" : "Supprimer définitivement ce message ?")) return;
    setIsUpdating(id);
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        if (selectedMessage?.id === id) setSelectedMessage(null);
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(null);
    }
  }

  function formatDate(val: Date | string) {
    const d = new Date(val);
    return d.toLocaleDateString(ar ? "ar-TN" : "fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Metric summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold">{ar ? "إجمالي الرسائل" : "Total messages"}</span>
          <div className="text-2xl font-bold text-[#082D55] mt-1 font-mono">{messages.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm">
          <span className="text-xs text-amber-700 font-semibold">{ar ? "رسائل جديدة" : "Nouveaux"}</span>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{countNew}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/40 shadow-sm">
          <span className="text-xs text-blue-700 font-semibold">{ar ? "تمت القراءة" : "Lus"}</span>
          <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">{countRead}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <span className="text-xs text-emerald-700 font-semibold">{ar ? "تمت المعالجة" : "Clôturés"}</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">{countClosed}</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ar ? "بحث بالاسم، البريد، أو الموضوع..." : "Rechercher par nom, email, objet..."}
            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#082D55]"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400">
            <Icon name="search" size={14} />
          </span>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(
            [
              { id: "ALL", label: ar ? "الكل" : "Tous" },
              { id: "new", label: ar ? "جديد" : "Nouveaux" },
              { id: "read", label: ar ? "مقروء" : "Lus" },
              { id: "closed", label: ar ? "مغلق" : "Clôturés" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-[#082D55] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Icon name="mail" size={32} />
            <p className="mt-2 font-medium">{ar ? "لا توجد رسائل مطابقة." : "Aucun message trouvé."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">{ar ? "المرسل" : "Expéditeur"}</th>
                  <th className="py-3 px-4">{ar ? "الموضوع" : "Objet"}</th>
                  <th className="py-3 px-4">{ar ? "التاريخ" : "Date"}</th>
                  <th className="py-3 px-4 text-center">{ar ? "الحالة" : "Statut"}</th>
                  <th className="py-3 px-4 text-end">{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((msg) => (
                  <tr
                    key={msg.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      msg.status === "new" ? "bg-amber-50/20 font-medium" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{msg.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{msg.email}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-[#082D55] truncate">{msg.subject}</div>
                      <div className="text-[11px] text-slate-500 truncate">{msg.message}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(msg.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          msg.status === "new"
                            ? "bg-amber-100 text-amber-800"
                            : msg.status === "read"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {msg.status === "new"
                          ? ar ? "جديد" : "Nouveau"
                          : msg.status === "read"
                          ? ar ? "مقروء" : "Lu"
                          : ar ? "معالج" : "Clôturé"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-end space-x-1 rtl:space-x-reverse whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMessage(msg);
                          if (msg.status === "new") updateStatus(msg.id, "read");
                        }}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-[#082D55] font-semibold"
                        title={ar ? "قراءة الرسالة" : "Lire le message"}
                      >
                        <Icon name="eye" size={15} />
                      </button>
                      <a
                        href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: [ANEI] ${msg.subject}`)}`}
                        className="inline-block p-1.5 rounded-md hover:bg-slate-100 text-amber-700"
                        title={ar ? "رد عبر البريد" : "Répondre par email"}
                      >
                        <Icon name="mail" size={15} />
                      </a>
                      {msg.status !== "closed" ? (
                        <button
                          type="button"
                          disabled={isUpdating === msg.id}
                          onClick={() => updateStatus(msg.id, "closed")}
                          className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700"
                          title={ar ? "إغلاق الطلب" : "Clôturer le ticket"}
                        >
                          <Icon name="check" size={15} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isUpdating === msg.id}
                          onClick={() => updateStatus(msg.id, "new")}
                          className="p-1.5 rounded-md hover:bg-amber-50 text-amber-700"
                          title={ar ? "إعادة الفتح" : "Rouvrir le ticket"}
                        >
                          <Icon name="arrow" size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isUpdating === msg.id}
                        onClick={() => deleteMessage(msg.id)}
                        className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600"
                        title={ar ? "حذف" : "Supprimer"}
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Message Modal Detail */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-xs text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#a66f24]">
                  {ar ? "تفاصيل الرسالة" : "Détails du message reçu"}
                </span>
                <h3 className="text-base font-bold text-[#082D55] mt-0.5">
                  {selectedMessage.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{ar ? "المرسل :" : "Expéditeur :"}</span>
                <strong>{selectedMessage.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{ar ? "البريد الإلكتروني :" : "Email :"}</span>
                <a href={`mailto:${selectedMessage.email}`} className="text-[#082D55] hover:underline font-mono">
                  {selectedMessage.email}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{ar ? "تاريخ الاستلام :" : "Date de réception :"}</span>
                <span>{formatDate(selectedMessage.createdAt)}</span>
              </div>
            </div>

            <div>
              <strong className="block text-slate-700 mb-1">{ar ? "نص الرسالة :" : "Contenu de la demande :"}</strong>
              <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {selectedMessage.message}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {selectedMessage.status !== "closed" ? (
                  <button
                    type="button"
                    onClick={() => updateStatus(selectedMessage.id, "closed")}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5"
                  >
                    <Icon name="check" size={14} />
                    <span>{ar ? "وضع علامة كمعالج" : "Marquer comme traité"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateStatus(selectedMessage.id, "read")}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold"
                  >
                    <span>{ar ? "إعادة الفتح" : "Rouvrir"}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Re: [ANEI] ${selectedMessage.subject}`)}`}
                  className="px-4 py-1.5 bg-[#082D55] hover:bg-[#061f3d] text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <Icon name="mail" size={14} />
                  <span>{ar ? "رد عبر البريد" : "Répondre par email"}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  {ar ? "إغلاق" : "Fermer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
