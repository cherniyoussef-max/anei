import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { retrieveKnowledgeChunks } from "@/server/ai/retriever";
import { buildPublicAssistantPrompt } from "@/server/ai/prompts";
import { getLLMProvider } from "@/server/ai/llm-provider";
import { checkAndConsumeAiQuota, recordAiUsageLog } from "@/server/ai/meter";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";

const requestSchema = z.object({
  message: z.string().trim().min(2, "Message too short").max(1000, "Message exceeds 1000 characters"),
  locale: z.enum(["fr", "ar"]).default("fr"),
});

export async function POST(req: NextRequest) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`assistant:public:${requestFingerprint(req)}`, 10, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. Please wait before sending another prompt." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { message, locale } = parsed.data;

    // Optional user session (supports both guests and parents)
    const session = await getSession().catch(() => null);
    const userId = session?.user?.id ?? null;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 1. Quota & Token-Drain Protection
    const quota = await checkAndConsumeAiQuota({
      audience: "PUBLIC",
      userId,
      ip,
      userAgent,
      estimatedTokens: Math.ceil(message.length / 3) + 400,
    });

    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason || "Rate limit reached. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(quota.retryAfterSeconds ?? 60),
          },
        },
      );
    }

    // 2. Hybrid Retrieval with Database Visibility Isolation
    const chunks = await retrieveKnowledgeChunks({
      query: message,
      locale,
      audience: "PUBLIC",
      userId,
      limit: 4,
    });

    // 3. Prompt Construction with Strict Guardrails
    const systemPrompt = buildPublicAssistantPrompt(locale, chunks);

    // 4. Invoke LLM Provider
    const startTime = Date.now();
    const provider = getLLMProvider();

    const output = await provider.chat({
      userId: userId ?? `guest-${requestFingerprint(req)}`,
      locale,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const durationMs = Date.now() - startTime;

    // Record usage asynchronously
    if (userId) {
      recordAiUsageLog({
        userId,
        provider: provider.name,
        inputTokens: output.usage?.inputTokens ?? 200,
        outputTokens: output.usage?.outputTokens ?? 100,
        durationMs,
        success: true,
      }).catch(() => undefined);
    }

    // 5. SSE Streaming Response
    const citations = chunks.map((c) => ({
      id: c.id,
      title: c.title,
      source: c.source,
      score: Number(c.score.toFixed(3)),
      snippet: c.text.slice(0, 160).trim() + "...",
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // First emit citations
        controller.enqueue(
          encoder.encode(`event: citations\ndata: ${JSON.stringify({ citations })}\n\n`),
        );

        // Stream text in readable word chunks
        const fullText = output.text;
        const words = fullText.split(" ");
        for (let i = 0; i < words.length; i += 3) {
          const slice = words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
          controller.enqueue(
            encoder.encode(`event: token\ndata: ${JSON.stringify({ text: slice })}\n\n`),
          );
        }

        // Emit done event
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              finished: true,
              usage: output.usage,
            })}\n\n`,
          ),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
