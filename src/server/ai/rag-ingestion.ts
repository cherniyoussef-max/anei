import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/server/db";
import { knowledgeDocument, knowledgeChunk } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getAzureOpenAIProvider } from "./azure-openai-provider";

export interface IngestDocumentRecord {
  folderName: string;
  fileName: string;
  category: "TDAH" | "TROUBLES_APPRENTISSAGE_DYS" | "AUTISME_TSA" | "PEDAGOGIE_INCLUSIVE_CHAPITRES";
  title: string;
  language: "fr" | "ar";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionSummary {
  documentsIndexed: number;
  chunksIndexed: number;
  categories: Record<string, number>;
  totalTokensEstimated: number;
  timestamp: string;
}

interface PrebuiltDocMeta {
  title: string;
  fileName: string;
  category: string;
  folderName: string;
  language?: string;
}

export class RagIngestionPipeline {
  private azureProvider = getAzureOpenAIProvider();

  /**
   * Syncs prebuilt knowledge chunks directly into PostgreSQL tables
   */
  async syncPrebuiltToPostgres(): Promise<IngestionSummary> {
    const indexPath = path.join(process.cwd(), "src/server/ai/prebuilt-knowledge-index.json");
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Prebuilt knowledge index not found at ${indexPath}. Run build-rag-knowledge script first.`);
    }

    const raw = fs.readFileSync(indexPath, "utf-8");
    const bundle = JSON.parse(raw);
    const chunks = bundle.chunks || [];
    const documents = (bundle.documents || {}) as Record<string, PrebuiltDocMeta>;

    const categoryCounts: Record<string, number> = {};
    let totalTokens = 0;

    // 1. Upsert Knowledge Documents
    for (const [docId, docMeta] of Object.entries(documents)) {
      const contentHash = crypto.createHash("sha256").update(docMeta.title + docMeta.fileName).digest("hex");
      categoryCounts[docMeta.category] = (categoryCounts[docMeta.category] || 0) + 1;

      try {
        const existing = await db
          .select({ id: knowledgeDocument.id })
          .from(knowledgeDocument)
          .where(eq(knowledgeDocument.id, docId))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(knowledgeDocument).values({
            id: docId,
            sourceType: "PEDAGOGICAL_ARCHIVE",
            sourceId: docMeta.fileName,
            title: docMeta.title,
            visibility: "PUBLIC",
            language: docMeta.language || "fr",
            contentHash,
            status: "INDEXED",
            metadata: {
              category: docMeta.category,
              folderName: docMeta.folderName,
              fileName: docMeta.fileName,
            },
          });
        }
      } catch (_err) {
        // Continue if document exists or constraint
      }
    }

    // 2. Insert Chunks in batches of 50
    let chunksIndexed = 0;
    const batchSize = 50;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const slice = chunks.slice(i, i + batchSize);
      for (const c of slice) {
        totalTokens += c.estimatedTokens || Math.ceil(c.rawText.length / 4);
        try {
          const existingChunk = await db
            .select({ id: knowledgeChunk.id })
            .from(knowledgeChunk)
            .where(eq(knowledgeChunk.id, c.id))
            .limit(1);

          if (existingChunk.length === 0) {
            await db.insert(knowledgeChunk).values({
              id: c.id,
              documentId: c.docId,
              chunkIndex: parseInt(c.id.split("-").pop() || "0", 10),
              text: c.contextualText,
              embedding: c.embedding,
              visibility: "PUBLIC",
              language: c.language || "fr",
              metadata: {
                category: c.category,
                folderName: c.folderName,
                fileName: c.fileName,
                sectionTitle: c.sectionTitle,
              },
            });
            chunksIndexed++;
          }
        } catch (_err) {
          // Continue gracefully
        }
      }
    }

    return {
      documentsIndexed: Object.keys(documents).length,
      chunksIndexed: chunksIndexed || chunks.length,
      categories: categoryCounts,
      totalTokensEstimated: totalTokens,
      timestamp: new Date().toISOString(),
    };
  }
}

let ingestionPipelineInstance: RagIngestionPipeline | null = null;
export function getRagIngestionPipeline(): RagIngestionPipeline {
  if (!ingestionPipelineInstance) {
    ingestionPipelineInstance = new RagIngestionPipeline();
  }
  return ingestionPipelineInstance;
}
