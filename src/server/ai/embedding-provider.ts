import "server-only";
import { env } from "@/server/env";
import type { EmbeddingProvider } from "./contracts";

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

const MAX_BATCH_SIZE = 100;
const MAX_INPUT_TOKENS_PER_BATCH = 8_000;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions: number;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = env.OPENAI_API_KEY ?? "";
    this.baseUrl = env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";
    this.model = env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    this.dimensions = env.AI_EMBEDDING_DIMENSIONS ?? 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const estimatedTokens = batch.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
      if (estimatedTokens > MAX_INPUT_TOKENS_PER_BATCH) {
        throw new Error(`Batch exceeds token limit: ${estimatedTokens} > ${MAX_INPUT_TOKENS_PER_BATCH}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
            dimensions: this.dimensions,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI Embeddings API error: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        const batchEmbeddings = data.data
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding);
        results.push(...batchEmbeddings);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("OpenAI Embeddings request timeout");
        }
        throw error;
      }
    }

    return results;
  }
}

export class TestEmbeddingProvider implements EmbeddingProvider {
  readonly name = "test";
  readonly dimensions = 1536;
  private embeddings: Map<string, number[]> = new Map();

  setEmbedding(text: string, embedding: number[]): void {
    this.embeddings.set(text, embedding);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const cached = this.embeddings.get(text);
      if (cached) return cached;
      const hash = simpleHash(text);
      return generateDeterministicEmbedding(hash, this.dimensions);
    });
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function generateDeterministicEmbedding(seed: number, dimensions: number): number[] {
  const embedding = new Array(dimensions);
  let x = seed;
  for (let i = 0; i < dimensions; i++) {
    x = (x * 1664525 + 1013904223) & 0xffffffff;
    embedding[i] = (x / 0xffffffff) * 2 - 1;
  }
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

let embeddingProviderInstance: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!embeddingProviderInstance) {
    if (env.NODE_ENV === "test" || !env.OPENAI_API_KEY) {
      embeddingProviderInstance = new TestEmbeddingProvider();
    } else {
      embeddingProviderInstance = new OpenAIEmbeddingProvider();
    }
  }
  return embeddingProviderInstance;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  embeddingProviderInstance = provider;
}