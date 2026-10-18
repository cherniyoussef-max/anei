import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { getHybridRAGEngine } from "@/server/ai/hybrid-rag-engine";
import { checkAndConsumeAiQuota, recordAiUsageLog } from "@/server/ai/meter";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { getLearnerCourseAiContext } from "@/server/ai/learner-context";

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

    // 2. Hybrid Agentic RAG Retrieval & Generation with Learner Course Context
    const startTime = Date.now();
    const learnerCourseContext = userId
      ? await getLearnerCourseAiContext(userId, locale).catch(() => "")
      : "";

    const ragEngine = getHybridRAGEngine();
    const ragResult = await ragEngine.generateTeacherResponse(message, locale, undefined, learnerCourseContext);
    const durationMs = Date.now() - startTime;
    const outputText = ragResult.answer;

    // Record usage asynchronously
    if (userId) {
      recordAiUsageLog({
        userId,
        provider: "azure-openai",
        inputTokens: Math.ceil(message.length / 3) + 400,
        outputTokens: Math.ceil(outputText.length / 3),
        durationMs,
        success: true,
      }).catch(() => undefined);
    }

    // 3. SSE Streaming Response with Citations
    const isGreeting = /^(hi|hello|bonjour|salut|salam|coucou|مرحبا|سلام|أهلا|اهلا|صباح الخير|مساء الخير)[\s!.]*$/i.test(message.trim());
    const isAccountOrNavQuestion = /(créer.*compte|inscription|inscrire|connecter|connexion|تسجيل|إنشاء.*حساب|دخول)/i.test(message);

    const citations = (isGreeting || isAccountOrNavQuestion) ? [] : ragResult.sources.map((s) => ({
      id: s.id,
      title: s.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      source: `[${s.folderName} / ${s.fileName}]`,
      score: Number(s.score.toFixed(3)),
      snippet: s.text.slice(0, 160).trim() + "...",
      category: s.category,
      fileName: s.fileName,
      sectionTitle: s.sectionTitle,
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // First emit citations
        controller.enqueue(
          encoder.encode(`event: citations\ndata: ${JSON.stringify({ citations })}\n\n`),
        );

        // Stream text in readable word chunks
        const fullText = outputText;
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
