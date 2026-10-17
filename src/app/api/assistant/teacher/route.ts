import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { retrieveKnowledgeChunks } from "@/server/ai/retriever";
import { buildTeacherAssistantPrompt } from "@/server/ai/prompts";
import { getLLMProvider } from "@/server/ai/llm-provider";
import { checkAndConsumeAiQuota, recordAiUsageLog } from "@/server/ai/meter";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";

const requestSchema = z.object({
  message: z.string().trim().min(3, "Prompt too short").max(2000, "Prompt exceeds 2000 characters"),
  locale: z.enum(["fr", "ar"]).default("fr"),
  courseId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  try {
    // 1. Enforce Authentication & Role-Based Access Control
    const session = await getSession().catch(() => null);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required to access the Teacher Pedagogical Assistant." },
        { status: 401 },
      );
    }

    const user = session.user;
    const role = user.role;
    const profileType = (user as { profileType?: string }).profileType;

    const isAuthorizedTeacherOrStaff =
      role === "ADMIN" ||
      role === "SUPER_ADMIN" ||
      profileType === "teacher" ||
      profileType === "specialist";

    if (!isAuthorizedTeacherOrStaff) {
      return NextResponse.json(
        {
          error:
            "Forbidden: The Teacher Pedagogical Assistant is reserved for educators, specialists, and academic staff.",
        },
        { status: 403 },
      );
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { message, locale, courseId } = parsed.data;

    // 2. Token-Drain Protection & Rate Limiting (Teacher tier)
    const rate = await consumeRateLimit(`assistant:teacher:${user.id}`, 30, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Teacher assistant rate limit reached." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const quota = await checkAndConsumeAiQuota({
      audience: "TEACHER",
      userId: user.id,
      estimatedTokens: Math.ceil(message.length / 3) + 800,
    });

    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason || "Teacher assistant rate limit reached." },
        {
          status: 429,
          headers: {
            "Retry-After": String(quota.retryAfterSeconds ?? 60),
          },
        },
      );
    }

    // 3. Hybrid Retrieval with Teacher Visibility Permissions
    const chunks = await retrieveKnowledgeChunks({
      query: message,
      locale,
      audience: "TEACHER",
      userId: user.id,
      role,
      courseId,
      limit: 6,
    });

    // 4. Pedagogical Prompt Construction
    const systemPrompt = buildTeacherAssistantPrompt(locale, chunks);

    // 5. Invoke LLM Provider
    const startTime = Date.now();
    const provider = getLLMProvider();

    const output = await provider.chat({
      userId: user.id,
      locale,
      courseId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const durationMs = Date.now() - startTime;

    // Record usage
    recordAiUsageLog({
      userId: user.id,
      provider: provider.name,
      inputTokens: output.usage?.inputTokens ?? 350,
      outputTokens: output.usage?.outputTokens ?? 250,
      durationMs,
      success: true,
    }).catch(() => undefined);

    // 6. SSE Streaming Response
    const citations = chunks.map((c) => ({
      id: c.id,
      title: c.title,
      source: c.source,
      visibility: c.visibility,
      score: Number(c.score.toFixed(3)),
      snippet: c.text.slice(0, 180).trim() + "...",
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`event: citations\ndata: ${JSON.stringify({ citations })}\n\n`),
        );

        const fullText = output.text;
        const words = fullText.split(" ");
        for (let i = 0; i < words.length; i += 3) {
          const slice = words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
          controller.enqueue(
            encoder.encode(`event: token\ndata: ${JSON.stringify({ text: slice })}\n\n`),
          );
        }

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
