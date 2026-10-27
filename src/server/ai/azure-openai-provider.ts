import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/server/env";
import { getRedis } from "@/server/cache/redis";

export interface AzureChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AzureChatOptions {
  messages: AzureChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AzureChatResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cached?: boolean;
}

// Multi-tier semantic & embedding cache (L1 Memory + L2 Redis) to maximize the Azure credit
interface CacheEntry {
  response: AzureChatResponse;
  expiresAt: number;
}
const queryCache = new Map<string, CacheEntry>();
const embeddingMemoryCache = new Map<string, number[]>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours L1
const REDIS_CACHE_TTL_SEC = 60 * 60 * 12; // 12 hours L2 (43,200 seconds)

export class AzureOpenAIProvider {
  private endpoint: string;
  private apiKey: string;
  private apiVersion: string;
  private chatDeployment: string;
  private embeddingDeployment: string;

  constructor() {
    this.endpoint = (
      process.env.AZURE_OPENAI_ENDPOINT ||
      env.AZURE_OPENAI_ENDPOINT ||
      "https://ycherni496-4106-resource.openai.azure.com"
    ).replace(/\/+$/, "");

    this.apiKey =
      process.env.AZURE_OPENAI_API_KEY ||
      env.AZURE_OPENAI_API_KEY ||
      env.OPENAI_API_KEY ||
      "";

    this.apiVersion =
      process.env.AZURE_OPENAI_API_VERSION ||
      env.AZURE_OPENAI_API_VERSION ||
      "2024-10-21";

    this.chatDeployment =
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ||
      env.AZURE_OPENAI_CHAT_DEPLOYMENT ||
      "anei-teacher-agent";

    this.embeddingDeployment =
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ||
      env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ||
      "anei-rag-embeddings";
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  getChatDeployment(): string {
    return this.chatDeployment;
  }

  getEmbeddingDeployment(): string {
    return this.embeddingDeployment;
  }

  /**
   * Generates vector embeddings for a list of strings using Azure text-embedding-3-small (1536d)
   */
  async embedTexts(texts: string[], batchSize = 50): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (!this.isConfigured()) {
      // Deterministic fallback for test/offline environments
      return texts.map((t) => this.generateFallbackEmbedding(t, 1536));
    }

    const redis = await getRedis().catch(() => null);
    const results: Array<number[] | null> = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const hashes: string[] = texts.map((t) => createHash("sha256").update(t).digest("hex"));

    // 1. Check L1 memory cache and L2 Redis cache
    for (let i = 0; i < texts.length; i++) {
      const hash = hashes[i];
      const mem = embeddingMemoryCache.get(hash);
      if (mem) {
        results[i] = mem;
        continue;
      }
      if (redis) {
        try {
          const raw = await redis.get(`cache:azure_openai:embedding:${hash}`);
          if (raw) {
            const vec = JSON.parse(raw) as number[];
            embeddingMemoryCache.set(hash, vec);
            results[i] = vec;
            continue;
          }
        } catch {
          // ignore cache read error
        }
      }
      uncachedIndices.push(i);
    }

    if (uncachedIndices.length === 0) {
      return results as number[][];
    }

    // 2. Fetch uncached in batches from Azure OpenAI
    const uncachedTexts = uncachedIndices.map((i) => texts[i]);
    const url = `${this.endpoint}/openai/deployments/${this.embeddingDeployment}/embeddings?api-version=${this.apiVersion}`;

    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      const batchIndices = uncachedIndices.slice(i, i + batchSize);
      const batch = uncachedTexts.slice(i, i + batchSize).map((t) => t.slice(0, 8000));
      let attempts = 0;
      let success = false;
      let lastError: Error | null = null;

      while (attempts < 3 && !success) {
        attempts++;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": this.apiKey,
            },
            body: JSON.stringify({ input: batch }),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Azure Embedding HTTP ${res.status}: ${errText.slice(0, 200)}`);
          }

          const data = (await res.json()) as {
            data: Array<{ embedding: number[]; index: number }>;
          };
          const sorted = data.data
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);

          for (let k = 0; k < batchIndices.length; k++) {
            const globalIdx = batchIndices[k];
            const vec = sorted[k];
            const hash = hashes[globalIdx];
            results[globalIdx] = vec;
            embeddingMemoryCache.set(hash, vec);
            if (redis) {
              redis.set(`cache:azure_openai:embedding:${hash}`, JSON.stringify(vec), { EX: REDIS_CACHE_TTL_SEC }).catch(() => {});
            }
          }
          success = true;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempts < 3) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
          }
        }
      }

      if (!success) {
        // Fallback to deterministic embeddings for this batch to avoid pipeline blockage
        console.warn(`[AzureOpenAIProvider] Embedding batch fallback: ${lastError?.message}`);
        for (let k = 0; k < batchIndices.length; k++) {
          const globalIdx = batchIndices[k];
          const fallback = this.generateFallbackEmbedding(texts[globalIdx], 1536);
          results[globalIdx] = fallback;
        }
      }
    }

    return results as number[][];
  }

  /**
   * Generates a single embedding
   */
  async embedSingle(text: string): Promise<number[]> {
    const [vec] = await this.embedTexts([text], 1);
    return vec;
  }

  /**
   * Generates a chat completion with multi-tier caching (L1 memory + L2 Redis) and automatic retry + fallback
   */
  async chatCompletion(options: AzureChatOptions): Promise<AzureChatResponse> {
    const cacheKeyRaw = JSON.stringify(options.messages);
    const hash = createHash("sha256").update(cacheKeyRaw).digest("hex");
    const redisKey = `cache:azure_openai:chat:${hash}`;

    // L1 Memory check
    const cached = queryCache.get(hash);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.response, cached: true };
    }

    // L2 Redis check
    const redis = await getRedis().catch(() => null);
    if (redis) {
      try {
        const raw = await redis.get(redisKey);
        if (raw) {
          const parsed = JSON.parse(raw) as AzureChatResponse;
          queryCache.set(hash, {
            response: parsed,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          return { ...parsed, cached: true };
        }
      } catch {
        // ignore cache read failure
      }
    }

    if (!this.isConfigured()) {
      return this.generateFallbackChatResponse(options);
    }

    const url = `${this.endpoint}/openai/deployments/${this.chatDeployment}/chat/completions?api-version=${this.apiVersion}`;

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": this.apiKey,
          },
          body: JSON.stringify({
            messages: options.messages,
            max_tokens: options.maxTokens ?? 1500,
            temperature: options.temperature ?? 0.3,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Azure ChatCompletion HTTP ${res.status}: ${errText.slice(0, 300)}`);
        }

        const data = (await res.json()) as {
          choices: Array<{ message: { content: string } }>;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        const reply = data.choices[0]?.message?.content ?? "";
        if (!reply) {
          throw new Error("Empty response choice from Azure OpenAI");
        }

        const result: AzureChatResponse = {
          content: reply,
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        };

        // Store in L1 and L2 cache
        queryCache.set(hash, {
          response: result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        if (redis) {
          redis.set(redisKey, JSON.stringify(result), { EX: REDIS_CACHE_TTL_SEC }).catch(() => {});
        }

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    console.warn(`[AzureOpenAIProvider] Chat completion fallback invoked: ${lastError?.message}`);
    return this.generateFallbackChatResponse(options);
  }

  /**
   * Domain-aware intelligent fallback response when Azure endpoint is unreachable or in test mode
   */
  private generateFallbackChatResponse(options: AzureChatOptions): AzureChatResponse {
    const userMsg = [...options.messages].reverse().find((m) => m.role === "user")?.content || "";
    const isAr = /[\u0600-\u06FF]/.test(userMsg);
    const lower = userMsg.toLowerCase();

    let content = "";
    if (isAr) {
      if (userMsg.includes("حساب") || userMsg.includes("تسجيل") || userMsg.includes("سجل") || userMsg.includes("دخول")) {
        content = "مرحباً بكم في الأكاديمية الوطنية للتربية الدامجة (ANEI).\n\nلإنشاء حساب جديد في المنصة، يرجى اتباع الخطوات التالية:\n1. التوجه مباشرة إلى صفحة التسجيل عبر الرابط: [/ar/auth/register](/ar/auth/register)\n2. تحديد صفتكم المهنية أو الأسرية: ولي أمر، معلّم، مرافق مدرسي (AVS)، أو أخصائي.\n3. إدخال الاسم، البريد الإلكتروني، وكلمة مرور آمنة.\n4. تأكيد البريد الإلكتروني عبر الرسالة المرسلة إليكم، ثم تسجيل الدخول للوصول الفوري لكافة الدورات والمكتبة.\n\nيسعدنا دائماً مرافقتكم في كل خطوة!";
      } else if (userMsg.includes("توحد") || userMsg.includes("طيف") || userMsg.includes("tsa")) {
        content = "مرحباً بكم في الأكاديمية الوطنية للتربية الدامجة (ANEI).\n\nبخصوص اضطراب طيف التوحد (TSA)، توفر الأكاديمية دليلاً تدريبياً شاملاً ومرجعياً معتمداً:\n1. دورة **اضطراب طيف التوحد: الفهم العلمي، المرافقة المدرسية والممارسات التربوية المبنية على البراهين**.\n2. تغطي الدورة استراتيجيات التواصل، الجداول البصرية (PECS)، وتنظيم البيئة الصفية والحسية.\n3. يمكنكم الاطلاع على كامل تفاصيل الدورة والتسجيل فيها عبر الرابط: [/ar/formations/trouble-spectre-autisme-accompagnement-scolaire](/ar/formations/trouble-spectre-autisme-accompagnement-scolaire)\n\nيسرّني توجيهكم لأي استفسار إضافي حول احتياجاتكم المحددة.";
      } else if (userMsg.includes("دورة") || userMsg.includes("تكوين") || userMsg.includes("سعر") || userMsg.includes("متاح")) {
        content = "مرحباً بكم في الأكاديمية الوطنية للتربية الدامجة (ANEI).\n\nتوفر الأكاديمية مسارات تكوينية مهنية معتمدة:\n1. تكوينات مرافقي الدمج المدرسي (AVS) والمعلمين في التربية الدامجة.\n2. برامج متخصصة في اضطراب طيف التوحد (TSA)، واضطراب فرط الحركة ونقص الانتباه (TDAH)، وصعوبات التعلم (Dys).\n3. يمكنكم استعراض فهرس التكوينات المتاحة وتفاصيل التسجيل والشهادات عبر الرابط: [/ar/formations](/ar/formations)\n\nنحن هنا لمساعدتكم في اختيار المسار الأنسب!";
      } else {
        content = "مرحباً بكم في الأكاديمية الوطنية للتربية الدامجة (ANEI).\n\nأنا مساعدكم الذكي لإرشادكم في إنشاء الحسابات، اختيار الدورات التكوينية المناسبة، والتوجيه نحو الموارد البيداغوجية المتخصصة في التربية الدامجة.\n\nيمكنكم زيارة دليل الدورات عبر [/ar/formations](/ar/formations) أو التسجيل عبر [/ar/auth/register](/ar/auth/register). كيف يمكنني مساعدتكم اليوم؟";
      }
    } else {
      if (lower.includes("compte") || lower.includes("inscri") || lower.includes("connect")) {
        content = "Bienvenue à l'Académie Nationale de l'Éducation Inclusive (ANEI).\n\nPour créer votre compte et commencer, voici les étapes simples :\n1. Rendez-vous sur la page d'inscription via le lien : [/fr/auth/register](/fr/auth/register)\n2. Choisissez votre profil : Parent, Enseignant, Accompagnant AVS ou Spécialiste.\n3. Renseignez votre nom, votre adresse email et un mot de passe sécurisé.\n4. Validez votre adresse par email, puis connectez-vous pour accéder immédiatement à vos formations et à la bibliothèque.\n\nN'hésitez pas si vous avez besoin d'aide pour cette inscription, je suis là pour vous guider !";
      } else if (lower.includes("autis") || lower.includes("tsa")) {
        content = "Bienvenue à l'Académie Nationale de l'Éducation Inclusive (ANEI).\n\nConcernant le Trouble du Spectre de l'Autisme (TSA), l'ANEI propose une formation certifiante de référence :\n1. Formation **Trouble du Spectre de l'Autisme (TSA) : Compréhension clinique, Accompagnement Scolaire & Pratiques Fondées sur les Preuves**.\n2. Ce cursus complet aborde les bases cliniques dyadiques, le soutien familial, les adaptations sensorielles et les méthodes recommandées (TEACCH, ABA, PECS).\n3. Vous pouvez découvrir le programme complet et vous inscrire sur : [/fr/formations/trouble-spectre-autisme-accompagnement-scolaire](/fr/formations/trouble-spectre-autisme-accompagnement-scolaire)\n\nJe reste à votre entière disposition pour tout renseignement complémentaire.";
      } else if (lower.includes("formation") || lower.includes("cours") || lower.includes("tarif") || lower.includes("prix")) {
        content = "Bienvenue à l'Académie Nationale de l'Éducation Inclusive (ANEI).\n\nNous proposons des formations certifiantes et pratiques :\n1. Métier d'accompagnant scolaire inclusif (AVS) et pédagogie différenciée.\n2. Troubles neurodéveloppementaux : TSA (Autisme), TDAH et Troubles spécifiques des apprentissages (Dys).\n3. Vous pouvez explorer notre catalogue complet avec les programmes et modalités sur : [/fr/formations](/fr/formations)\n\nQuelle est votre situation ou votre projet d'apprentissage ?";
      } else {
        content = "Bienvenue à l'Académie Nationale de l'Éducation Inclusive (ANEI).\n\nJe suis votre assistant pour vous orienter dans la création de compte, le choix de vos formations certifiantes et l'accompagnement éducatif inclusif.\n\nVous pouvez explorer nos formations sur [/fr/formations](/fr/formations) ou créer votre compte sur [/fr/auth/register](/fr/auth/register). Que puis-je faire pour vous aujourd'hui ?";
      }
    }

    return {
      content,
      inputTokens: 30,
      outputTokens: 120,
      totalTokens: 150,
      cached: false,
    };
  }

  /**
   * Streams a chat completion response via SSE ReadableStream
   */
  async streamChat(options: AzureChatOptions): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.endpoint}/openai/deployments/${this.chatDeployment}/chat/completions?api-version=${this.apiVersion}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify({
        messages: options.messages,
        max_tokens: options.maxTokens ?? 1500,
        temperature: options.temperature ?? 0.3,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Azure Streaming HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    return res.body;
  }

  /**
   * Deterministic unit-vector embedding for test suites or fallback
   */
  private generateFallbackEmbedding(text: string, dimensions = 1536): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    const vec: number[] = new Array(dimensions);
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
      const val = Math.sin(hash + i * 1.61803398875);
      vec[i] = val;
      norm += val * val;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
    return vec;
  }
}

let providerInstance: AzureOpenAIProvider | null = null;
export function getAzureOpenAIProvider(): AzureOpenAIProvider {
  if (!providerInstance) {
    providerInstance = new AzureOpenAIProvider();
  }
  return providerInstance;
}
