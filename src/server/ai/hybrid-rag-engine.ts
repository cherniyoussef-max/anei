import "server-only";
import prebuiltBundleRaw from "./prebuilt-knowledge-index.json";
import { getAzureOpenAIProvider } from "./azure-openai-provider";
import { buildTeacherAgentSystemPrompt, RetrievedChunkContext } from "./teacher-agent-prompt";

export interface KnowledgeChunk {
  id: string;
  docId: string;
  category: "TDAH" | "TROUBLES_APPRENTISSAGE_DYS" | "AUTISME_TSA" | "PEDAGOGIE_INCLUSIVE_CHAPITRES";
  folderName: string;
  fileName: string;
  sectionTitle: string;
  language: "fr" | "ar";
  rawText: string;
  contextualText: string;
  charCount: number;
  estimatedTokens: number;
  embedding: number[];
}

export interface PrebuiltKnowledgeBundle {
  metadata: {
    version: string;
    generatedAt: string;
    totalDocuments: number;
    totalChunks: number;
    embeddingModel: string;
    dimensions: number;
    categories: string[];
  };
  documents: Record<string, unknown>;
  chunks: KnowledgeChunk[];
}

export interface HybridSearchResult {
  chunk: KnowledgeChunk;
  denseScore: number;
  sparseScore: number;
  rrfScore: number;
}

export interface QueryIntent {
  originalQuery: string;
  locale: "fr" | "ar";
  detectedCategory?: "TDAH" | "TROUBLES_APPRENTISSAGE_DYS" | "AUTISME_TSA" | "PEDAGOGIE_INCLUSIVE_CHAPITRES";
  expandedKeywordsFr: string[];
  expandedKeywordsAr: string[];
  targetAudience: "teacher" | "avs" | "parent" | "specialist";
}

// In-memory prebuilt knowledge index cache
let loadedBundle: PrebuiltKnowledgeBundle | null = null;

function loadKnowledgeBundle(): PrebuiltKnowledgeBundle | null {
  if (loadedBundle) return loadedBundle;
  loadedBundle = prebuiltBundleRaw as unknown as PrebuiltKnowledgeBundle;
  return loadedBundle;
}

/**
 * Calculates cosine similarity between two unit vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * BM25-like sparse lexical scoring
 */
function calculateSparseScore(keywords: string[], text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (!kw || kw.length < 2) continue;
    const lowerKw = kw.toLowerCase();
    // Count occurrences
    const regex = new RegExp(`\\b${escapeRegExp(lowerKw)}`, "gi");
    const matches = lower.match(regex);
    if (matches) {
      // Logarithmic term frequency
      score += 1 + Math.log(matches.length);
    }
  }
  return score;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class HybridAgenticRAGEngine {
  private azureProvider = getAzureOpenAIProvider();

  /**
   * Step A: Query Understanding & Cross-Lingual Expansion
   */
  understandQuery(query: string, preferredLocale: "fr" | "ar"): QueryIntent {
    const isArabic = /[\u0600-\u06FF]/.test(query);
    const locale: "fr" | "ar" = isArabic ? "ar" : preferredLocale;
    const lower = query.toLowerCase();

    let detectedCategory: QueryIntent["detectedCategory"] = undefined;
    const kwFr: string[] = [];
    const kwAr: string[] = [];

    // TDAH Detection & Expansion
    if (
      lower.includes("tdah") ||
      lower.includes("hyperactiv") ||
      lower.includes("inattent") ||
      lower.includes("impulsiv") ||
      lower.includes("concentration") ||
      lower.includes("agitation") ||
      lower.includes("bouge") ||
      lower.includes("se lève") ||
      (lower.includes("coupe") && lower.includes("parole")) ||
      lower.includes("crie les réponses") ||
      lower.includes("lever la main") ||
      lower.includes("oubli de matériel") ||
      lower.includes("oublie ses cahiers") ||
      lower.includes("tiers-temps") ||
      lower.includes("fatigabilit") ||
      lower.includes("فرط الحركة") ||
      lower.includes("تشتت الانتباه") ||
      lower.includes("اندفاع") ||
      lower.includes("قصر الانتباه") ||
      lower.includes("كثير الحركة")
    ) {
      detectedCategory = "TDAH";
      kwFr.push("TDAH", "hyperactivité", "impulsivité", "attention", "classe", "aménagement", "temps", "sommeil");
      kwAr.push("فرط الحركة", "تشتت الانتباه", "الاندفاعية", "التركيز", "القسم", "تكييف");
    }
    // TSA / Autisme (check before DYS so autism communication / premack aren't miscategorized)
    else if (
      lower.includes("autis") ||
      lower.includes("tsa") ||
      lower.includes("spectre") ||
      lower.includes("pecs") ||
      lower.includes("teacch") ||
      lower.includes("aba") ||
      lower.includes("premack") ||
      lower.includes("d'abord") ||
      lower.includes("non-verbal") ||
      lower.includes("non verbal") ||
      lower.includes("échange d'images") ||
      lower.includes("caa") ||
      lower.includes("sensoriel") ||
      lower.includes("se bouche les oreilles") ||
      lower.includes("surcharge sensorielle") ||
      lower.includes("stéréotypi") ||
      lower.includes("écholali") ||
      lower.includes("crise") ||
      lower.includes("توحد") ||
      lower.includes("طيف التوحد") ||
      lower.includes("تيتش") ||
      lower.includes("بيكس") ||
      lower.includes("الجداول البصرية") ||
      lower.includes("روتين") ||
      lower.includes("غير ناطق")
    ) {
      detectedCategory = "AUTISME_TSA";
      kwFr.push("autisme", "TSA", "TEACCH", "PECS", "communication", "sensoriel", "d'abord ensuite", "guidance");
      kwAr.push("طيف التوحد", "تيتش", "بيكس", "التواصل البديل", "الحسي", "أولا ثم", "السلوك الوظيفي");
    }
    // DYS / Troubles d'apprentissage
    else if (
      lower.includes("dys") ||
      lower.includes("dyslex") ||
      lower.includes("dysortho") ||
      lower.includes("dyscalc") ||
      lower.includes("dysprax") ||
      lower.includes("dysphas") ||
      lower.includes("lecture") ||
      lower.includes("calcul") ||
      lower.includes("écriture") ||
      lower.includes("orthographe") ||
      lower.includes("déchiffr") ||
      lower.includes("synthèse vocale") ||
      lower.includes("manuscrite") ||
      lower.includes("numération") ||
      lower.includes("صعوبات التعلم") ||
      lower.includes("تهجئة") ||
      lower.includes("القراءة الجهرية") ||
      (lower.includes("صعوبة") && (lower.includes("قراءة") || lower.includes("كتابة") || lower.includes("تهجئة") || lower.includes("حساب"))) ||
      lower.includes("عسر القراءة") ||
      lower.includes("عسر الحساب") ||
      lower.includes("عسر الكتابة") ||
      lower.includes("الدسلكسيا")
    ) {
      detectedCategory = "TROUBLES_APPRENTISSAGE_DYS";
      kwFr.push("dyslexie", "dysorthographie", "dyscalculie", "dyspraxie", "apprentissage", "lecture", "écriture", "adaptation");
      kwAr.push("صعوبات التعلم", "عسر القراءة", "عسر الكتابة", "عسر الحساب", "الدسلكسيا", "تكييف بيداغوجي");
    }
    // Pédagogie inclusive générale / UDL / AVS / PEI
    else {
      detectedCategory = "PEDAGOGIE_INCLUSIVE_CHAPITRES";
      kwFr.push("pédagogie inclusive", "différenciation", "AVS", "PEI", "UDL", "aménagement", "évaluation");
      kwAr.push("التعليم الدامج", "البيداغوجيا الفارقية", "المرافق المدرسي", "خطة فردية", "التصميم الشامل");
    }

    // Detect target audience
    let targetAudience: QueryIntent["targetAudience"] = "teacher";
    if (lower.includes("avs") || lower.includes("مرافق")) targetAudience = "avs";
    if (lower.includes("parent") || lower.includes("maman") || lower.includes("papa") || lower.includes("أب") || lower.includes("أم") || lower.includes("ولي")) targetAudience = "parent";
    if (lower.includes("orthophoniste") || lower.includes("psychologue") || lower.includes("spécialiste") || lower.includes("مختص")) targetAudience = "specialist";

    // Add query words
    const queryTokens = query.split(/[\s,;.!?'"()]+/);
    for (const t of queryTokens) {
      if (t.length > 3) {
        if (/[\u0600-\u06FF]/.test(t)) kwAr.push(t);
        else kwFr.push(t);
      }
    }

    return {
      originalQuery: query,
      locale,
      detectedCategory,
      expandedKeywordsFr: Array.from(new Set(kwFr)),
      expandedKeywordsAr: Array.from(new Set(kwAr)),
      targetAudience,
    };
  }

  /**
   * Step B: Weighted Hybrid Retrieval (Dense Vector + Sparse Lexical + RRF)
   */
  async retrieveChunks(
    intent: QueryIntent,
    topK = 8
  ): Promise<RetrievedChunkContext[]> {
    const bundle = loadKnowledgeBundle();
    if (!bundle || bundle.chunks.length === 0) {
      return [];
    }

    // 1. Generate Query Vector Embedding
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await this.azureProvider.embedSingle(intent.originalQuery);
    } catch {
      queryEmbedding = [];
    }

    const allKeywords = [...intent.expandedKeywordsFr, ...intent.expandedKeywordsAr];

    // 2. Compute Dense and Sparse Scores for candidates
    const scoredList: HybridSearchResult[] = [];

    for (const chunk of bundle.chunks) {
      const dense = queryEmbedding.length > 0 ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
      const sparse = calculateSparseScore(allKeywords, chunk.contextualText);

      // Metadata Category Boost (+0.25 bonus if category matches intent)
      const categoryBoost = chunk.category === intent.detectedCategory ? 0.25 : 0;

      scoredList.push({
        chunk,
        denseScore: dense + categoryBoost,
        sparseScore: sparse + categoryBoost * 5,
        rrfScore: 0,
      });
    }

    // 3. Compute Reciprocal Rank Fusion (RRF)
    const RRF_K = 60;
    // Rank by dense
    scoredList.sort((a, b) => b.denseScore - a.denseScore);
    const denseRanks = new Map<string, number>();
    scoredList.forEach((item, idx) => denseRanks.set(item.chunk.id, idx + 1));

    // Rank by sparse
    scoredList.sort((a, b) => b.sparseScore - a.sparseScore);
    const sparseRanks = new Map<string, number>();
    scoredList.forEach((item, idx) => sparseRanks.set(item.chunk.id, idx + 1));

    // Calculate fused score
    for (const item of scoredList) {
      const dRank = denseRanks.get(item.chunk.id) ?? 999;
      const sRank = sparseRanks.get(item.chunk.id) ?? 999;
      item.rrfScore = 1 / (RRF_K + dRank) + 1 / (RRF_K + sRank);
    }

    // Sort by RRF
    scoredList.sort((a, b) => b.rrfScore - a.rrfScore);

    // 4. Maximal Marginal Relevance (MMR) deduplication: avoid multiple chunks from same file
    const selected: KnowledgeChunk[] = [];
    const seenFiles = new Set<string>();

    for (const item of scoredList) {
      if (selected.length >= topK) break;
      const fileKey = item.chunk.fileName;
      // Allow max 2 chunks per file to promote diversity across documents
      const fileCount = selected.filter((c) => c.fileName === fileKey).length;
      if (fileCount < 2) {
        selected.push(item.chunk);
        seenFiles.add(fileKey);
      }
    }

    // If still have room, add remaining top scored items
    if (selected.length < topK) {
      for (const item of scoredList) {
        if (selected.length >= topK) break;
        if (!selected.some((s) => s.id === item.chunk.id)) {
          selected.push(item.chunk);
        }
      }
    }

    return selected.map((c) => ({
      id: c.id,
      category: c.category,
      folderName: c.folderName,
      fileName: c.fileName,
      sectionTitle: c.sectionTitle,
      text: c.rawText.length > 1600 ? c.rawText.slice(0, 1600) + "..." : c.rawText,
      score: 0.95,
    }));
  }

  /**
   * Complete End-to-End Hybrid Agentic Generation
   */
  async generateTeacherResponse(
    query: string,
    locale: "fr" | "ar" = "fr",
    studentContext?: {
      age?: number;
      grade?: string;
      condition?: string;
      role?: "teacher" | "avs" | "parent" | "specialist";
    },
    learnerCourseContext?: string
  ): Promise<{
    answer: string;
    sources: RetrievedChunkContext[];
    intent: QueryIntent;
    tokensUsed: number;
    cached?: boolean;
  }> {
    // 1. Understand Query & Expand
    const intent = this.understandQuery(query, locale);

    // 2. Hybrid Retrieval (Top 4 high-density chunks)
    const sources = await this.retrieveChunks(intent, 4);

    // 3. Build Expert Pedagogical System Prompt
    const systemPrompt = buildTeacherAgentSystemPrompt(intent.locale, sources, studentContext, learnerCourseContext);

    // 4. Generate Response via Azure OpenAI LLM
    const res = await this.azureProvider.chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      maxTokens: 1600,
      temperature: 0.3,
    });

    return {
      answer: res.content,
      sources,
      intent,
      tokensUsed: res.totalTokens,
      cached: res.cached,
    };
  }

  /**
   * Streaming response generator for real-time SSE
   */
  async streamTeacherResponse(
    query: string,
    locale: "fr" | "ar" = "fr",
    studentContext?: {
      age?: number;
      grade?: string;
      condition?: string;
      role?: "teacher" | "avs" | "parent" | "specialist";
    }
  ): Promise<{
    stream: ReadableStream<Uint8Array>;
    sources: RetrievedChunkContext[];
    intent: QueryIntent;
  }> {
    const intent = this.understandQuery(query, locale);
    const sources = await this.retrieveChunks(intent, 8);
    const systemPrompt = buildTeacherAgentSystemPrompt(intent.locale, sources, studentContext);

    const stream = await this.azureProvider.streamChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      maxTokens: 1600,
      temperature: 0.3,
    });

    return { stream, sources, intent };
  }
}

let ragEngineInstance: HybridAgenticRAGEngine | null = null;
export function getHybridRAGEngine(): HybridAgenticRAGEngine {
  if (!ragEngineInstance) {
    ragEngineInstance = new HybridAgenticRAGEngine();
  }
  return ragEngineInstance;
}
