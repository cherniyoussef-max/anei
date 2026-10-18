import "server-only";
import { env } from "@/server/env";

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

// In-memory semantic/query cache to maximize the $60 credit
interface CacheEntry {
  response: AzureChatResponse;
  expiresAt: number;
}
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

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

    const allEmbeddings: number[][] = [];
    const url = `${this.endpoint}/openai/deployments/${this.embeddingDeployment}/embeddings?api-version=${this.apiVersion}`;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 8000));
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

          allEmbeddings.push(...sorted);
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
        const fallback = batch.map((t) => this.generateFallbackEmbedding(t, 1536));
        allEmbeddings.push(...fallback);
      }
    }

    return allEmbeddings;
  }

  /**
   * Generates a single embedding
   */
  async embedSingle(text: string): Promise<number[]> {
    const [vec] = await this.embedTexts([text], 1);
    return vec;
  }

  /**
   * Generates a chat completion with optional caching
   */
  async chatCompletion(options: AzureChatOptions): Promise<AzureChatResponse> {
    const cacheKey = JSON.stringify(options.messages);
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.response, cached: true };
    }

    if (!this.isConfigured()) {
      return {
        content: "L'assistant ANEI est actuellement en mode test local. Les réponses pédagogiques complètes sont disponibles avec la clé Azure configurée.",
        inputTokens: 20,
        outputTokens: 30,
        totalTokens: 50,
      };
    }

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
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Azure ChatCompletion HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const reply = data.choices[0]?.message?.content ?? "";
    const result: AzureChatResponse = {
      content: reply,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };

    // Store in cache
    queryCache.set(cacheKey, {
      response: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
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
