export interface VectorStoreChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorStoreSearchInput {
  queryEmbedding: number[];
  filter?: {
    organizationId?: string | null;
    visibility?: string[];
    documentIds?: string[];
  };
  limit: number;
}

export interface VectorStoreSearchResult {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorStore {
  upsertChunks(chunks: VectorStoreChunk[]): Promise<void>;
  search(input: VectorStoreSearchInput): Promise<VectorStoreSearchResult[]>;
  deleteDocumentChunks(documentId: string): Promise<void>;
  close(): Promise<void>;
}

export class InMemoryVectorStore implements VectorStore {
  private chunks: VectorStoreChunk[] = [];

  async upsertChunks(chunks: VectorStoreChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const existingIndex = this.chunks.findIndex((c) => c.id === chunk.id);
      if (existingIndex >= 0) {
        this.chunks[existingIndex] = chunk;
      } else {
        this.chunks.push(chunk);
      }
    }
  }

  async search(input: VectorStoreSearchInput): Promise<VectorStoreSearchResult[]> {
    let candidates = this.chunks;

    if (input.filter?.documentIds?.length) {
      candidates = candidates.filter((c) => input.filter!.documentIds!.includes(c.documentId));
    }

    const results = candidates
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(input.queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);

    return results;
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
  }

  async close(): Promise<void> {
    this.chunks = [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new InMemoryVectorStore();
  }
  return vectorStoreInstance;
}

export function setVectorStore(store: VectorStore): void {
  vectorStoreInstance = store;
}