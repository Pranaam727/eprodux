"""
RAG ingestion pipeline.

Reads .txt and .md files from the knowledge directory, splits them into
chunks, and builds a TF-IDF index for retrieval.

The index is stored in memory (and optionally serialised to disk with pickle)
so it survives service restarts without re-reading all documents.

Design notes:
- Uses scikit-learn TfidfVectorizer — no external embedding API needed.
- This keeps the RAG layer fully offline-capable.
- To upgrade to dense embeddings later, replace only this module and retrieval.py.
- Do NOT store copyrighted documents in the knowledge/ directory without
  verifying licensing. The synthetic_test_guide.txt fixture is the only
  pre-bundled document.
"""

from __future__ import annotations

import json
import logging
import os
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class DocumentChunk:
    """A single text chunk with source metadata."""
    chunk_id: str
    text: str
    source_title: str
    organization: str
    filename: str
    section: str = ""


@dataclass
class KnowledgeIndex:
    """In-memory TF-IDF index over document chunks."""
    chunks: List[DocumentChunk] = field(default_factory=list)
    vectorizer: Optional[object] = None  # sklearn TfidfVectorizer
    matrix: Optional[object] = None      # sparse matrix (n_chunks × vocab)


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def _chunk_text(text: str, max_chars: int = 1200, overlap: int = 100) -> List[str]:
    """Split text into overlapping character-level chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - overlap
    return chunks


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------

def _parse_metadata_header(text: str) -> dict:
    """
    Parse optional YAML-style header lines from a document.
    Supports:  Title: ..., Author: ..., Organization: ...
    Returns a dict with found keys (lower-cased).
    """
    meta: dict = {}
    for line in text.splitlines()[:20]:
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().lower()
            if key in {"title", "author", "organization", "version", "purpose"}:
                meta[key] = val.strip()
    return meta


def ingest_documents(knowledge_dir: str) -> KnowledgeIndex:
    """
    Read all .txt and .md files from knowledge_dir and build a TF-IDF index.

    Returns a KnowledgeIndex. If the directory is empty or missing, returns
    an index with zero chunks (retrieval will return empty results).
    """
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
    except ImportError as exc:
        raise RuntimeError(
            "scikit-learn is required for RAG ingestion. "
            "Install it with: pip install scikit-learn"
        ) from exc

    knowledge_path = Path(knowledge_dir)
    if not knowledge_path.exists():
        logger.warning("Knowledge directory not found: %s — RAG disabled.", knowledge_dir)
        return KnowledgeIndex()

    all_chunks: List[DocumentChunk] = []
    doc_files = list(knowledge_path.glob("*.txt")) + list(knowledge_path.glob("*.md"))

    if not doc_files:
        logger.warning("No .txt or .md files found in %s — RAG index empty.", knowledge_dir)
        return KnowledgeIndex()

    for doc_path in doc_files:
        try:
            raw = doc_path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            logger.error("Could not read %s: %s", doc_path, e)
            continue

        meta = _parse_metadata_header(raw)
        title = meta.get("title", doc_path.stem)
        organization = meta.get("organization", "Unknown")

        text_chunks = _chunk_text(raw)
        for i, chunk_text in enumerate(text_chunks):
            chunk = DocumentChunk(
                chunk_id=f"{doc_path.stem}::chunk_{i}",
                text=chunk_text,
                source_title=title,
                organization=organization,
                filename=str(doc_path),
                section=f"chunk {i + 1}/{len(text_chunks)}",
            )
            all_chunks.append(chunk)

        logger.info("Ingested %d chunks from %s", len(text_chunks), doc_path.name)

    if not all_chunks:
        return KnowledgeIndex()

    texts = [c.text for c in all_chunks]
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=10_000,
        sublinear_tf=True,
    )
    matrix = vectorizer.fit_transform(texts)

    logger.info("RAG index built: %d chunks, vocabulary size %d", len(all_chunks), len(vectorizer.vocabulary_))
    return KnowledgeIndex(chunks=all_chunks, vectorizer=vectorizer, matrix=matrix)


# ---------------------------------------------------------------------------
# Persistence (optional)
# ---------------------------------------------------------------------------

def save_index(index: KnowledgeIndex, path: str) -> None:
    """Serialise index to disk using pickle."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(index, f)
    logger.info("RAG index saved to %s", path)


def load_index(path: str) -> Optional[KnowledgeIndex]:
    """Load a previously saved index, or return None if not found."""
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            index = pickle.load(f)
        logger.info("RAG index loaded from %s (%d chunks)", path, len(index.chunks))
        return index
    except Exception as e:
        logger.warning("Failed to load RAG index from %s: %s — will rebuild.", path, e)
        return None
