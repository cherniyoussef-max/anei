-- Extends outbox_event.event_type with WHATSAPP_AI_REPLY (WhatsApp AI
-- auto-reply dispatch, see src/server/queue/handlers/whatsapp-ai-reply.ts).
-- Payload carries only { inboundMessageId }; the worker reloads every other
-- fact from the database, matching the WHATSAPP_TEMPLATE_SEND/
-- AUTOMATION_TRIGGER convention.

ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_event_type_check";
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_event_type_check" CHECK ("outbox_event"."event_type" in ('WHATSAPP_TEMPLATE_SEND','AUTOMATION_TRIGGER','WHATSAPP_AI_REPLY'));
