export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
  maxChunks?: number;
}

export interface DocumentChunk {
  index: number;
  text: string;
  metadata?: Record<string, unknown>;
}

export function chunkText(text: string, options: ChunkOptions): DocumentChunk[] {
  const { maxChars, overlapChars, maxChunks } = options;
  const chunks: DocumentChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length && (!maxChunks || index < maxChunks)) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastSpace, lastNewline);
      if (breakPoint > start + maxChars / 2) {
        end = breakPoint;
      }
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ index, text: chunkText });
      index++;
    }

    start = end - overlapChars;
    if (start < 0) start = 0;
    if (start >= text.length) break;
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}