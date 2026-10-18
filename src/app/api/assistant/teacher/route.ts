import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { getHybridRAGEngine } from "@/server/ai/hybrid-rag-engine";
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

    const { message, locale, courseId: _courseId } = parsed.data;

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

    // 3. Hybrid Agentic RAG Retrieval & Generation
    const startTime = Date.now();
    const ragEngine = getHybridRAGEngine();
    const ragResult = await ragEngine.generateTeacherResponse(message, locale, {
      role: profileType === "specialist" ? "specialist" : "teacher",
    });

    const durationMs = Date.now() - startTime;
    const outputText = ragResult.answer;

    // Record usage
    recordAiUsageLog({
      userId: user.id,
      provider: "azure-openai",
      inputTokens: Math.ceil(message.length / 3) + 600,
      outputTokens: Math.ceil(outputText.length / 3),
      durationMs,
      success: true,
    }).catch(() => undefined);

    // 4. SSE Streaming Response with Citations
    const citations = ragResult.sources.map((s) => ({
      id: s.id,
      title: s.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      source: `[${s.folderName} / ${s.fileName}]`,
      visibility: "TEACHER",
      score: Number(s.score.toFixed(3)),
      snippet: s.text.slice(0, 180).trim() + "...",
      category: s.category,
      fileName: s.fileName,
      sectionTitle: s.sectionTitle,
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`event: citations\ndata: ${JSON.stringify({ citations })}\n\n`),
        );

        const fullText = outputText;
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
              usage: { totalTokens: ragResult.tokensUsed },
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
