import "server-only";
import { getLLMProvider } from "@/server/ai/llm-provider";
import type { AiMessage } from "@/server/ai/contracts";

const MAX_REPLY_CHARS = 1_000;
const MAX_HISTORY_MESSAGES = 20;

/**
 * System prompt for the WhatsApp auto-reply assistant. Dev/staging only
 * (src/server/env.ts refuses ENABLE_WHATSAPP_AI_REPLIES in production) — no
 * tool/function-calling surface, no retrieval, no ability to mutate any ANEI
 * data: this is a bounded text-in/text-out assistant, not the Phase 10 AI
 * chat widget (src/server/ai/contracts.ts's ToolRegistry/Retriever), so it
 * carries none of that surface's authorization requirements.
 */
const SYSTEM_PROMPT = `Tu es l'assistant WhatsApp d'ANEI (Académie Nationale de l'Éducation Inclusive), une plateforme tunisienne d'éducation inclusive bilingue français/arabe.

Détecte automatiquement la langue et le registre de la personne qui écrit — français, arabe standard (فصحى), ou arabe tunisien / derja tunisienne (تونسي) écrite en caractères arabes ou en arabizi (chiffres/latin, ex: "chna7welek", "3andi mochkla") — et réponds TOUJOURS dans la même langue/registre que le dernier message de la personne. Si la personne écrit en derja tunisienne, réponds en derja tunisienne naturelle et chaleureuse, pas en arabe littéraire.

Ton rôle : accueillir, orienter et répondre aux questions générales sur ANEI (formations, inscription, accompagnement, informations pratiques) de façon chaleureuse, professionnelle et concise (2-4 phrases, adaptées à WhatsApp).

Règles strictes :
- Ne jamais inventer de prix, de dates, de disponibilités ou d'informations que tu ne connais pas avec certitude — dis que tu vérifies ou oriente vers l'équipe ANEI.
- Ne jamais prétendre pouvoir effectuer une action (inscription, paiement, modification de compte) — oriente toujours vers le site ou l'équipe humaine pour toute action réelle.
- Reste toujours respectueux, inclusif et professionnel, jamais familier de façon déplacée.
- Si la demande est sensible, urgente, ou hors de ta portée, dis clairement qu'un membre de l'équipe ANEI va prendre le relais.`;

export type WhatsAppHistoryMessage = { direction: "INBOUND" | "OUTBOUND"; text: string | null };

function toAiMessages(history: WhatsAppHistoryMessage[]): AiMessage[] {
  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m.text)
    .map((m) => ({ role: m.direction === "INBOUND" ? "user" : "assistant", content: m.text!.slice(0, 2_000) }));
}

/**
 * Generates a bounded WhatsApp reply. Never throws for a "no good answer"
 * case (returns a safe fallback instead) — only throws on a genuine
 * provider failure, which the caller (the outbox handler) classifies as
 * retryable/terminal like every other provider call.
 */
export async function generateWhatsAppReply(input: {
  history: WhatsAppHistoryMessage[];
  latestInboundText: string;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const provider = getLLMProvider();
  const messages: AiMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...toAiMessages(input.history),
  ];
  if (!messages.some((m) => m.role === "user" && m.content === input.latestInboundText.slice(0, 2_000))) {
    messages.push({ role: "user", content: input.latestInboundText.slice(0, 2_000) });
  }

  const result = await provider.chat({ userId: "whatsapp-ai-reply", locale: "fr", messages });
  const text = result.text.trim().slice(0, MAX_REPLY_CHARS) || "Merci pour votre message, un membre de l'équipe ANEI vous répondra bientôt.";
  return { text, inputTokens: result.usage?.inputTokens ?? 0, outputTokens: result.usage?.outputTokens ?? 0 };
}
