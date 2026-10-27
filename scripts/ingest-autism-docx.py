#!/usr/bin/env python3
"""
Ingests FORMATION AUTISM.docx directly into src/server/ai/prebuilt-knowledge-index.json.
Uses the identical chunking, contextualization, and deterministic 1536d unit embedding format.
"""

import json
import math
import os
import re
import time
import zipfile
import xml.etree.ElementTree as ET

DOCX_PATH = "FORMATION AUTISM.docx"
INDEX_PATH = "src/server/ai/prebuilt-knowledge-index.json"

def clean_text(text: str) -> str:
    text = re.sub(r'[\r\t]', ' ', text)
    text = re.sub(r' +', ' ', text)
    text = re.sub(r'\n +', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def extract_docx_paragraphs(path: str) -> list[str]:
    with zipfile.ZipFile(path) as z:
        xml_content = z.read("word/document.xml")
        tree = ET.fromstring(xml_content)
        paragraphs = []
        for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
            p_text = "".join(node.text for node in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if node.text)
            cleaned = clean_text(p_text)
            if cleaned:
                paragraphs.append(cleaned)
        return paragraphs

def generate_embedding(text: str, dimensions: int = 1536) -> list[float]:
    # Match generateFallbackEmbedding from AzureOpenAIProvider and build-rag-knowledge.py
    h = 0
    for ch in text:
        h = ((h << 5) - h + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000

    vec = [math.sin(h + i * 1.61803398875) for i in range(dimensions)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [round(x / norm, 8) for x in vec]

def main():
    if not os.path.exists(DOCX_PATH):
        print(f"Error: {DOCX_PATH} not found.")
        return

    if not os.path.exists(INDEX_PATH):
        print(f"Error: {INDEX_PATH} not found.")
        return

    print(f"Reading {DOCX_PATH}...")
    paragraphs = extract_docx_paragraphs(DOCX_PATH)
    print(f"Extracted {len(paragraphs)} paragraphs.")

    # Chunk paragraphs (target ~1800 chars / ~450 tokens, overlap ~300 chars)
    target_chars = 1800
    overlap_chars = 300

    raw_chunks = []
    current_chunk = []
    current_len = 0
    section_title = "دليل اضطراب طيف التوحد (TSA)"

    for p in paragraphs:
        # Heading detection in Arabic / general
        is_heading = (
            len(p) < 90 and
            not p.endswith(".") and
            not p.endswith("،") and
            (
                p.startswith("الفصل") or
                p.startswith("المحور") or
                p.startswith("أولًا") or
                p.startswith("ثانيًا") or
                p.startswith("ثالثًا") or
                p.startswith("رابعًا") or
                p.startswith("خامسًا") or
                p.startswith("سادسًا") or
                p.startswith("سابعًا") or
                p.startswith("ثامنًا") or
                p.startswith("تاسعًا") or
                p.startswith("عاشرًا") or
                re.match(r"^\d+\.", p) is not None or
                p.endswith(":")
            )
        )
        if is_heading:
            section_title = p.strip(": ")

        p_len = len(p)
        if current_len + p_len > target_chars and current_chunk:
            combined = "\n\n".join(current_chunk)
            raw_chunks.append({
                "section": section_title,
                "text": combined
            })
            if len(current_chunk[-1]) < overlap_chars:
                current_chunk = [current_chunk[-1], p]
                current_len = len(current_chunk[0]) + p_len
            else:
                current_chunk = [p]
                current_len = p_len
        else:
            current_chunk.append(p)
            current_len += p_len

    if current_chunk:
        raw_chunks.append({
            "section": section_title,
            "text": "\n\n".join(current_chunk)
        })

    print(f"Formed {len(raw_chunks)} chunks.")

    with open(INDEX_PATH, "r", encoding="utf-8") as fp:
        index_data = json.load(fp)

    existing_docs = index_data.get("documents", {})
    existing_chunks = index_data.get("chunks", [])

    # Filter out any prior FORMATION AUTISM chunks if already ingested
    existing_chunks = [c for c in existing_chunks if c.get("fileName") != "FORMATION AUTISM.docx"]

    doc_id = "doc-autism-formation"
    existing_docs[doc_id] = {
        "id": doc_id,
        "title": "دليل التكوين المعتمد في اضطراب طيف التوحد (TSA)",
        "fileName": "FORMATION AUTISM.docx",
        "folderName": "Formation Autisme",
        "category": "AUTISME_TSA",
        "language": "ar",
        "charLength": sum(len(p) for p in paragraphs)
    }

    new_chunks = []
    for idx, rc in enumerate(raw_chunks):
        if len(rc["text"]) < 80:
            continue
        chunk_id = f"{doc_id}-{idx+1:03d}"
        contextual_prefix = f"[Catégorie: AUTISME_TSA | Dossier: Formation Autisme | Document: FORMATION AUTISM.docx | Section: {rc['section']}]"
        contextual_text = f"{contextual_prefix}\n\n{rc['text']}"
        embedding = generate_embedding(contextual_text, 1536)

        chunk_entry = {
            "id": chunk_id,
            "docId": doc_id,
            "category": "AUTISME_TSA",
            "folderName": "Formation Autisme",
            "fileName": "FORMATION AUTISM.docx",
            "sectionTitle": rc["section"],
            "language": "ar",
            "rawText": rc["text"],
            "contextualText": contextual_text,
            "charCount": len(contextual_text),
            "estimatedTokens": len(contextual_text) // 4,
            "embedding": embedding
        }
        new_chunks.append(chunk_entry)

    print(f"Created {len(new_chunks)} enriched chunks with 1536d embeddings.")

    all_chunks = existing_chunks + new_chunks

    index_data["documents"] = existing_docs
    index_data["chunks"] = all_chunks
    index_data["metadata"]["totalDocuments"] = len(existing_docs)
    index_data["metadata"]["totalChunks"] = len(all_chunks)
    index_data["metadata"]["lastUpdated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with open(INDEX_PATH, "w", encoding="utf-8") as fp:
        json.dump(index_data, fp, ensure_ascii=False)

    size_mb = os.path.getsize(INDEX_PATH) / (1024 * 1024)
    print(f"Successfully saved {INDEX_PATH} ({size_mb:.2f} MB).")
    print(f"Total documents: {len(existing_docs)}, Total chunks: {len(all_chunks)}.")

if __name__ == "__main__":
    main()
