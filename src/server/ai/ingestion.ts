import "server-only";
import { db } from "@/server/db";
import { knowledgeDocument, knowledgeChunk } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { getEmbeddingProvider } from "@/server/ai/embedding-provider";
import { getVectorStore } from "@/server/ai/vector-store";
import { chunkText } from "./chunking";

const CHUNK_MAX_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 200;
const MAX_CHUNKS_PER_DOCUMENT = 200;

export interface IngestDocumentInput {
  organizationId?: string | null;
  sourceType: string;
  sourceId?: string;
  title: string;
  visibility: "PUBLIC" | "PLATFORM" | "ORGANIZATION" | "PRIVATE";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  documentId: string;
  chunksCreated: number;
  status: "INDEXED" | "FAILED";
}

export async function ingestDocument(input: IngestDocumentInput): Promise<IngestResult> {
  const contentHash = crypto.createHash("sha256").update(input.content).digest("hex");

  const orgId = input.organizationId ?? null;
  const sourceId = input.sourceId ?? "";

  const [existing] = await db
    .select({ id: knowledgeDocument.id, status: knowledgeDocument.status })
    .from(knowledgeDocument)
    .where(
      and(
        eq(knowledgeDocument.sourceType, input.sourceType),
        eq(knowledgeDocument.sourceId, sourceId),
        orgId ? eq(knowledgeDocument.organizationId, orgId) : sql`${knowledgeDocument.organizationId} is null`
      )
    )
    .limit(1);

  if (existing && existing.status === "INDEXED" && existing.id) {
    const [doc] = await db
      .select({ contentHash: knowledgeDocument.contentHash })
      .from(knowledgeDocument)
      .where(eq(knowledgeDocument.id, existing.id))
      .limit(1);

    if (doc?.contentHash === contentHash) {
      return { documentId: existing.id, chunksCreated: 0, status: "INDEXED" };
    }
  }

  const documentId = existing?.id ?? crypto.randomUUID();

  try {
    const chunks = chunkText(input.content, {
      maxChars: CHUNK_MAX_CHARS,
      overlapChars: CHUNK_OVERLAP_CHARS,
      maxChunks: MAX_CHUNKS_PER_DOCUMENT,
    });

    if (chunks.length === 0) {
      throw new Error("No valid chunks generated");
    }

    const embeddingProvider = getEmbeddingProvider();
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embeddingProvider.embed(chunkTexts);

    const vectorStore = getVectorStore();
    await vectorStore.deleteDocumentChunks(documentId);
    await vectorStore.upsertChunks(
      chunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        documentId,
        chunkIndex: chunk.index,
        text: chunk.text,
        embedding: embeddings[index],
        metadata: { ...input.metadata, source: input.sourceType },
      }))
    );

    if (existing) {
      await db
        .update(knowledgeDocument)
        .set({
          title: input.title,
          visibility: input.visibility,
          contentHash,
          status: "INDEXED",
          updatedAt: new Date(),
        })
        .where(eq(knowledgeDocument.id, documentId));
    } else {
      await db.insert(knowledgeDocument).values({
        id: documentId,
        organizationId: orgId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        title: input.title,
        visibility: input.visibility,
        contentHash,
        status: "INDEXED",
      });
    }

    return { documentId, chunksCreated: chunks.length, status: "INDEXED" };
  } catch (error) {
    await db
      .update(knowledgeDocument)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(eq(knowledgeDocument.id, documentId));
    throw error;
  }
}

export async function deleteDocument(documentId: string): Promise<void> {
  const vectorStore = getVectorStore();
  await vectorStore.deleteDocumentChunks(documentId);
  await db.delete(knowledgeDocument).where(eq(knowledgeDocument.id, documentId));
}

export async function reindexDocument(documentId: string): Promise<IngestResult> {
  const [doc] = await db
    .select()
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error("Document not found");
  }

  return ingestDocument({
    organizationId: doc.organizationId,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId ?? undefined,
    title: doc.title,
    visibility: doc.visibility as "PUBLIC" | "PLATFORM" | "ORGANIZATION" | "PRIVATE",
    content: "",
    metadata: (doc.metadata as Record<string, unknown>) ?? undefined,
  });
}

export async function getDocumentStatus(documentId: string) {
  return db
    .select({
      id: knowledgeDocument.id,
      status: knowledgeDocument.status,
      title: knowledgeDocument.title,
      visibility: knowledgeDocument.visibility,
      chunksCreated: sql<number>`(select count(*) from ${knowledgeChunk} where ${knowledgeChunk.documentId} = ${knowledgeDocument.id})`,
    })
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.id, documentId))
    .limit(1);
}