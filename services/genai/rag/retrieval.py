"""
RAG retrieval — cosine similarity search over the TF-IDF index.

retrieve(query, top_k) returns a ranked list of passages with source metadata.
When no relevant passage is found (or the index is empty), it returns an
empty list — never a fabricated citation.

The caller must handle the empty-list case explicitly and communicate to the
user that no guideline source was available.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from rag.ingestion import KnowledgeIndex

logger = logging.getLogger(__name__)


@dataclass
class RetrievedPassage:
    """A retrieved chunk with relevance score and source metadata."""
    chunk_id: str
    text: str
    source_title: str
    organization: str
    filename: str
    score: float  # cosine similarity [0, 1]


# Module-level index singleton (populated at startup)
_index: Optional[KnowledgeIndex] = None


def set_index(index: KnowledgeIndex) -> None:
    """Register the global knowledge index (called at app startup)."""
    global _index
    _index = index
    logger.info("RAG retrieval index set (%d chunks).", len(index.chunks) if index else 0)


def get_index() -> Optional[KnowledgeIndex]:
    return _index


def retrieve(query: str, top_k: int = 3) -> List[RetrievedPassage]:
    """
    Return up to top_k passages most relevant to query.

    Returns an empty list when:
    - The index is not loaded or empty.
    - No passage exceeds the minimum relevance threshold.
    - scikit-learn is unavailable.

    IMPORTANT: An empty return value means "no source available" —
    the caller must NOT fabricate a citation in this case.
    """
    if _index is None or not _index.chunks:
        logger.debug("RAG index empty or not loaded — returning no passages.")
        return []

    if _index.vectorizer is None or _index.matrix is None:
        logger.debug("RAG index has no vectorizer — returning no passages.")
        return []

    try:
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        logger.warning("scikit-learn/numpy not available — RAG retrieval disabled.")
        return []

    # Vectorise the query
    try:
        query_vec = _index.vectorizer.transform([query])
    except Exception as e:
        logger.warning("Failed to vectorise query: %s", e)
        return []

    # Compute cosine similarities
    sims = cosine_similarity(query_vec, _index.matrix).flatten()

    # Rank by score descending
    top_indices = np.argsort(sims)[::-1][:top_k]

    MIN_SCORE = 0.05  # discard completely irrelevant results
    results: List[RetrievedPassage] = []
    for idx in top_indices:
        score = float(sims[idx])
        if score < MIN_SCORE:
            break
        chunk = _index.chunks[idx]
        results.append(
            RetrievedPassage(
                chunk_id=chunk.chunk_id,
                text=chunk.text,
                source_title=chunk.source_title,
                organization=chunk.organization,
                filename=chunk.filename,
                score=score,
            )
        )

    logger.debug("RAG retrieved %d passages for query (top score %.3f).", len(results), results[0].score if results else 0.0)
    return results
