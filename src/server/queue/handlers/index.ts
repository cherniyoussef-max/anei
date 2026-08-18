import type { OutboxEventType } from "@/server/queue/event-types";
import { whatsappTemplateSendHandler } from "@/server/queue/handlers/whatsapp-template-send";
import { automationTriggerHandler } from "@/server/queue/handlers/automation-trigger";

/**
 * Fixed handler registry. The worker only ever dispatches through this map —
 * it never reads a handler name from the database. Extending it requires
 * extending the DB event_type CHECK (drizzle/000N_*.sql) and the allowlist in
 * src/server/queue/event-types.ts.
 */
export const outboxHandlers = {
  WHATSAPP_TEMPLATE_SEND: whatsappTemplateSendHandler,
  AUTOMATION_TRIGGER: automationTriggerHandler,
} as const satisfies Record<OutboxEventType, unknown>;