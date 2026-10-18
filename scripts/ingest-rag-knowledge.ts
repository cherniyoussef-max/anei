#!/usr/bin/env tsx
import { getRagIngestionPipeline } from "../src/server/ai/rag-ingestion";

async function main() {
  console.log("==================================================================");
  console.log("🔄 SYNCING PREBUILT RAG KNOWLEDGE INTO POSTGRESQL KNOWLEDGE BASE");
  console.log("==================================================================");

  try {
    const pipeline = getRagIngestionPipeline();
    const summary = await pipeline.syncPrebuiltToPostgres();

    console.log(`✅ Indexed ${summary.documentsIndexed} documents and ${summary.chunksIndexed} chunks into PostgreSQL.`);
    console.log("📊 Category Breakdown:");
    for (const [cat, count] of Object.entries(summary.categories)) {
      console.log(`   - ${cat}: ${count} documents`);
    }
    console.log(`💡 Estimated token footprint: ~${summary.totalTokensEstimated.toLocaleString()} tokens`);
    console.log("🎉 Knowledge Base Sync Completed Successfully!");
  } catch (err) {
    console.warn("⚠️ Postgres Sync Warning (fallback to memory index active):", err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  console.error("Fatal error during sync:", err);
  process.exit(1);
});
