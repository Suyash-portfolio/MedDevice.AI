import logging
from .retriever import Retriever
from .utils import format_rag_response, extract_device_from_chunk

logger = logging.getLogger(__name__)

class RAGPipeline:
    """Orchestrates the RAG retrieval pipeline with fallback to existing ML pipeline."""

    def __init__(self, similarity_threshold=0.50):
        self.retriever = Retriever(similarity_threshold=similarity_threshold)
        self.fallback_fn = None

    def set_fallback(self, fallback_fn):
        """Set the fallback function (hybrid_query from app.py).

        fallback_fn should accept (user_query) and return (answer_text, confidence, source).
        """
        self.fallback_fn = fallback_fn

    def answer(self, user_query):
        """Answer a user query using RAG with fallback.

        Flow:
          1. Embed query using SentenceTransformer
          2. Search FAISS for top-5 chunks
          3. If high confidence: format RAG response
          4. Else: fall back to existing hybrid_query
          5. If fallback also fails: return None

        Returns:
            (answer_text, metadata_dict) or (None, None) if no answer found.
        """
        results = self.retriever.retrieve(user_query, k=5)

        if results and self.retriever.has_high_confidence(results):
            answer, metadata = format_rag_response(results)
            if answer:
                metadata["pipeline"] = "rag"
                return answer, metadata

        if self.fallback_fn is not None:
            try:
                result_text, confidence, source = self.fallback_fn(user_query)
                if result_text and confidence > 0.01:
                    device = extract_device_from_chunk(result_text)
                    source_label_map = {
                        "ml": "Device Dataset",
                        "cosine": "Device Dataset",
                    }
                    metadata = {
                        "device_name": device or "",
                        "manufacturer": "",
                        "retrieved_from": source_label_map.get(source, "Device Dataset"),
                        "similarity_score": round(confidence, 4),
                        "confidence_pct": round(confidence * 100, 2),
                        "pipeline": "fallback"
                    }
                    return result_text, metadata
            except Exception as e:
                logger.error(f"Fallback pipeline error: {e}")

        return None, None

    def is_ready(self):
        """Check if the RAG pipeline is ready (index loaded)."""
        return self.retriever.is_loaded and self.retriever.faiss_manager.index_size() > 0
