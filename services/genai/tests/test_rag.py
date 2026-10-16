"""
Tests for the RAG ingestion and retrieval pipeline.

Uses the real synthetic_test_guide.txt document — no mocks needed for retrieval.
"""

import os
import pytest

GENAI_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KNOWLEDGE_DIR = os.path.join(GENAI_ROOT, "rag", "knowledge")


class TestIngestion:
    def test_index_built_from_synthetic_guide(self, rag_index):
        """Ingestion produces at least one chunk from the test document."""
        assert rag_index is not None
        assert len(rag_index.chunks) > 0

    def test_chunks_have_metadata(self, rag_index):
        """Each chunk carries source_title and organization metadata."""
        for chunk in rag_index.chunks:
            assert chunk.source_title, f"Missing source_title on chunk {chunk.chunk_id}"
            assert chunk.organization, f"Missing organization on chunk {chunk.chunk_id}"
            assert chunk.filename, f"Missing filename on chunk {chunk.chunk_id}"

    def test_synthetic_label_present(self, rag_index):
        """The synthetic document is labelled as a test fixture."""
        titles = [c.source_title for c in rag_index.chunks]
        # At least one chunk from the synthetic guide
        assert any("synthetic" in t.lower() or "sample" in t.lower() or "university" in t.lower() for t in titles)

    def test_vectorizer_fitted(self, rag_index):
        """Vectorizer and matrix are present after ingestion."""
        assert rag_index.vectorizer is not None
        assert rag_index.matrix is not None

    def test_empty_dir_returns_empty_index(self, tmp_path):
        """Empty knowledge directory returns an index with zero chunks."""
        from rag.ingestion import ingest_documents
        index = ingest_documents(str(tmp_path))
        assert index.chunks == []

    def test_missing_dir_returns_empty_index(self):
        from rag.ingestion import ingest_documents
        index = ingest_documents("/nonexistent/path/xyz")
        assert index.chunks == []


class TestRetrieval:
    @pytest.fixture(autouse=True)
    def load_index(self, rag_index):
        from rag.retrieval import set_index
        set_index(rag_index)

    def test_relevant_query_returns_results(self):
        """Query about lighting should return relevant passages."""
        from rag.retrieval import retrieve
        results = retrieve("lighting occupancy unoccupied room switch off", top_k=3)
        assert len(results) > 0

    def test_results_have_source_metadata(self):
        from rag.retrieval import retrieve
        results = retrieve("energy efficiency building", top_k=2)
        for r in results:
            assert r.source_title
            assert r.organization
            assert r.filename
            assert r.text

    def test_scores_between_zero_and_one(self):
        from rag.retrieval import retrieve
        results = retrieve("HVAC temperature setpoint", top_k=3)
        for r in results:
            assert 0.0 <= r.score <= 1.0

    def test_irrelevant_query_returns_empty_or_low_score(self):
        """Completely unrelated query should return nothing or low-score results."""
        from rag.retrieval import retrieve
        results = retrieve("quantum entanglement superconductor photon", top_k=3)
        # Either empty or all scores below meaningful threshold
        for r in results:
            assert r.score < 0.3  # no good match expected

    def test_no_fabricated_citation_on_empty_index(self):
        """Empty index returns empty list — never a fabricated citation."""
        from rag.ingestion import KnowledgeIndex
        from rag.retrieval import retrieve, set_index
        set_index(KnowledgeIndex())
        results = retrieve("any query at all")
        assert results == []

    def test_top_k_respected(self):
        from rag.retrieval import retrieve
        results = retrieve("lighting energy occupancy sensor", top_k=2)
        assert len(results) <= 2

    def test_chunks_are_real_text(self):
        from rag.retrieval import retrieve
        results = retrieve("CO2 ventilation demand control", top_k=2)
        for r in results:
            assert len(r.text) > 20  # not an empty or trivial chunk

    def test_citation_traceable(self):
        """Returned passages link back to the actual file on disk."""
        from rag.retrieval import retrieve
        results = retrieve("occupancy sensor lighting control", top_k=2)
        for r in results:
            assert os.path.exists(r.filename), (
                f"Citation points to non-existent file: {r.filename}"
            )
