import "server-only";
import { db } from "@/server/db";
import { knowledgeChunk, knowledgeDocument, organizationMembership } from "@/server/db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getEmbeddingProvider } from "./embedding-provider";
import { getVectorStore } from "./vector-store";
import type { Retriever, RetrievalResult } from "./contracts";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const MIN_SCORE_THRESHOLD = 0.45;
const RRF_K = 60;

export type PersonaAudience = "PUBLIC" | "TEACHER";

export interface RetrieveKnowledgeChunksInput {
  query: string;
  locale: "fr" | "ar";
  audience?: PersonaAudience;
  userId?: string | null;
  role?: string | null;
  organizationId?: string | null;
  courseId?: string;
  limit?: number;
}

export interface KnowledgeChunkResult {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  score: number;
  visibility: string;
  language: string;
  source: string;
  title: string;
  courseId?: string;
  resourceId?: string;
}

/**
 * Server-side visibility resolver: strictly enforces role boundaries.
 * Public guests, parents, and learners can NEVER access TEACHER or PRIVATE documents.
 */
export function resolveAllowedVisibilities(options: {
  audience?: PersonaAudience;
  role?: string | null;
  isOrgMember?: boolean;
}): string[] {
  const isTeacherOrAdmin =
    options.role === "ADMIN" ||
    options.role === "SUPER_ADMIN" ||
    options.role === "teacher" ||
    options.role === "specialist" ||
    options.role === "TEACHER" ||
    options.role === "SPECIALIST";

  // If audience is TEACHER, user must have appropriate educator/staff credentials
  if (options.audience === "TEACHER" && isTeacherOrAdmin) {
    const list = ["PUBLIC", "TEACHER", "PLATFORM"];
    if (options.isOrgMember) list.push("ORGANIZATION");
    return list;
  }

  // Fallback / Public audience: strictly public content
  const list = ["PUBLIC"];
  if (options.isOrgMember) list.push("ORGANIZATION");
  return list;
}

/**
 * Calculates Reciprocal Rank Fusion (RRF) between vector search and text relevance.
 */
export function calculateRRF(
  vectorRankMap: Map<string, number>,
  textRankMap: Map<string, number>,
  k = RRF_K,
): Map<string, number> {
  const fusedScores = new Map<string, number>();

  for (const [id, rank] of vectorRankMap.entries()) {
    const current = fusedScores.get(id) ?? 0;
    fusedScores.set(id, current + 1 / (k + rank));
  }

  for (const [id, rank] of textRankMap.entries()) {
    const current = fusedScores.get(id) ?? 0;
    fusedScores.set(id, current + 1 / (k + rank));
  }

  return fusedScores;
}

/**
 * Checks active organization membership for tenant isolation.
 */
export async function hasActiveOrgMembership(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db
    .select({ organizationId: organizationMembership.organizationId })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.organizationId, organizationId),
        eq(organizationMembership.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return Boolean(membership[0]);
}

/**
 * High-performance Hybrid Knowledge Retriever.
 * Combines vector embeddings with full-text search via Reciprocal Rank Fusion (RRF).
 * Strictly guarantees database-level visibility isolation between Public/Parent and Teacher bots.
 */
export async function retrieveKnowledgeChunks(
  input: RetrieveKnowledgeChunksInput,
): Promise<KnowledgeChunkResult[]> {
  const {
    query,
    locale,
    audience = "PUBLIC",
    userId,
    role,
    organizationId,
    courseId,
    limit = DEFAULT_LIMIT,
  } = input;

  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // 1. Authorize organization membership if requested
  const isOrgMember = Boolean(
    userId && organizationId && (await hasActiveOrgMembership(userId, organizationId)),
  );

  // 2. Resolve strictly authorized visibilities
  const allowedVisibilities = resolveAllowedVisibilities({
    audience,
    role,
    isOrgMember,
  });

  // 3. Generate query embedding
  const embeddingProvider = getEmbeddingProvider();
  const [queryEmbedding] = await embeddingProvider.embed([query]);

  // 4. Retrieve allowed document IDs from database
  const docConditions = [
    eq(knowledgeDocument.status, "INDEXED"),
    inArray(knowledgeDocument.visibility, allowedVisibilities),
  ];

  if (organizationId && isOrgMember) {
    docConditions.push(
      or(
        inArray(knowledgeDocument.visibility, ["PUBLIC", "TEACHER", "PLATFORM"]),
        and(
          eq(knowledgeDocument.visibility, "ORGANIZATION"),
          eq(knowledgeDocument.organizationId, organizationId),
        ),
      )!,
    );
  }

  const allowedDocs = await db
    .select({
      id: knowledgeDocument.id,
      title: knowledgeDocument.title,
      sourceType: knowledgeDocument.sourceType,
      visibility: knowledgeDocument.visibility,
      language: knowledgeDocument.language,
    })
    .from(knowledgeDocument)
    .where(and(...docConditions))
    .limit(100);

  if (allowedDocs.length === 0) {
    return [];
  }

  const allowedDocMap = new Map(allowedDocs.map((d) => [d.id, d]));
  const allowedDocIds = allowedDocs.map((d) => d.id);

  // 5. Vector Search
  const vectorStore = getVectorStore();
  const vectorResults = await vectorStore.search({
    queryEmbedding,
    filter: { documentIds: allowedDocIds },
    limit: safeLimit * 3,
  });

  // Also query knowledgeChunk table directly from DB if vector store is sparse
  const dbChunkConditions = [
    inArray(knowledgeChunk.documentId, allowedDocIds),
    inArray(knowledgeChunk.visibility, allowedVisibilities),
  ];
  if (courseId) {
    dbChunkConditions.push(sql`${knowledgeChunk.metadata}->>'courseId' = ${courseId}`);
  }

  const dbChunks = await db
    .select({
      id: knowledgeChunk.id,
      documentId: knowledgeChunk.documentId,
      chunkIndex: knowledgeChunk.chunkIndex,
      text: knowledgeChunk.text,
      visibility: knowledgeChunk.visibility,
      language: knowledgeChunk.language,
      metadata: knowledgeChunk.metadata,
    })
    .from(knowledgeChunk)
    .where(and(...dbChunkConditions))
    .limit(safeLimit * 4);

  // Combine candidates
  type Candidate = {
    id: string;
    documentId: string;
    chunkIndex: number;
    text: string;
    visibility: string;
    language: string;
    metadata?: Record<string, unknown>;
    vectorScore: number;
    textScore: number;
  };

  const candidateMap = new Map<string, Candidate>();

  for (const c of dbChunks) {
    candidateMap.set(c.id, {
      id: c.id,
      documentId: c.documentId,
      chunkIndex: c.chunkIndex,
      text: c.text,
      visibility: c.visibility,
      language: c.language,
      metadata: (c.metadata as Record<string, unknown>) ?? undefined,
      vectorScore: 0,
      textScore: 0,
    });
  }

  for (const vr of vectorResults) {
    const existing = candidateMap.get(vr.id);
    if (existing) {
      existing.vectorScore = vr.score;
    } else {
      const parentDoc = allowedDocMap.get(vr.documentId);
      if (parentDoc) {
        candidateMap.set(vr.id, {
          id: vr.id,
          documentId: vr.documentId,
          chunkIndex: vr.chunkIndex,
          text: vr.text,
          visibility: parentDoc.visibility,
          language: parentDoc.language,
          metadata: vr.metadata,
          vectorScore: vr.score,
          textScore: 0,
        });
      }
    }
  }

  const candidates = Array.from(candidateMap.values());
  if (candidates.length === 0) return [];

  // Filter candidates strictly matching language if specified
  const filteredCandidates = candidates.filter(
    (c) => !c.language || c.language === locale,
  );
  const activeCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates;

  // 6. Text relevance scoring (Lexical/BM25 style matching)
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  for (const cand of activeCandidates) {
    const textLower = cand.text.toLowerCase();
    let termMatches = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) termMatches += 1;
    }
    cand.textScore = queryTerms.length > 0 ? termMatches / queryTerms.length : 0;
  }

  // 7. Compute Ranks for Vector & Text
  const vectorRankMap = new Map<string, number>();
  [...activeCandidates]
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .forEach((item, index) => vectorRankMap.set(item.id, index + 1));

  const textRankMap = new Map<string, number>();
  [...activeCandidates]
    .sort((a, b) => b.textScore - a.textScore)
    .forEach((item, index) => textRankMap.set(item.id, index + 1));

  // 8. Reciprocal Rank Fusion
  const rrfScores = calculateRRF(vectorRankMap, textRankMap);

  // 9. Format final results
  const rankedResults: KnowledgeChunkResult[] = activeCandidates
    .map((c) => {
      const doc = allowedDocMap.get(c.documentId);
      const rrfScore = rrfScores.get(c.id) ?? 0;
      return {
        id: c.id,
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        score: rrfScore,
        visibility: c.visibility,
        language: c.language,
        title: doc?.title ?? "Document",
        source: (c.metadata?.source as string) ?? doc?.sourceType ?? "library",
        courseId: c.metadata?.courseId as string | undefined,
        resourceId: c.metadata?.resourceId as string | undefined,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);

  return rankedResults;
}

// -----------------------------------------------------------------------------
// Legacy Retriever Adapter for existing LMS & integration tests
// -----------------------------------------------------------------------------
export class PgVectorRetriever implements Retriever {
  async search(input: {
    query: string;
    locale: "fr" | "ar";
    userId: string;
    organizationId?: string | null;
    courseId?: string;
    limit?: number;
  }): Promise<RetrievalResult[]> {
    const { query, locale, userId, organizationId, courseId, limit = DEFAULT_LIMIT } = input;
    const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

    const authorizedOrgId =
      organizationId && (await hasActiveOrgMembership(userId, organizationId))
        ? organizationId
        : null;

    const chunks = await retrieveKnowledgeChunks({
      query,
      locale,
      audience: "PUBLIC",
      userId,
      organizationId: authorizedOrgId,
      courseId,
      limit: safeLimit,
    });

    return chunks
      .filter((r) => r.score >= MIN_SCORE_THRESHOLD || r.score > 0)
      .map((r) => ({
        id: r.id,
        text: r.text,
        score: r.score,
        source: r.source,
        courseId: r.courseId,
        resourceId: r.resourceId,
      }));
  }
}

export class TestRetriever implements Retriever {
  private documents: Array<{
    id: string;
    text: string;
    source: string;
    courseId?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }> = [];

  setDocuments(
    docs: Array<{
      id: string;
      text: string;
      source: string;
      courseId?: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
    }>,
  ): void {
    this.documents = docs;
  }

  async search(input: {
    query: string;
    locale: "fr" | "ar";
    userId: string;
    organizationId?: string | null;
    courseId?: string;
    limit?: number;
  }): Promise<RetrievalResult[]> {
    const { limit = DEFAULT_LIMIT } = input;
    return this.documents.slice(0, limit).map((d) => ({
      id: d.id,
      text: d.text,
      score: 0.9,
      source: d.source,
      courseId: d.courseId,
      resourceId: d.resourceId,
    }));
  }
}

let retrieverInstance: Retriever | null = null;

export function getRetriever(): Retriever {
  if (!retrieverInstance) {
    retrieverInstance = new PgVectorRetriever();
  }
  return retrieverInstance;
}

export function setRetriever(retriever: Retriever): void {
  retrieverInstance = retriever;
}
