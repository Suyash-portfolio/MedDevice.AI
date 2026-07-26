from .embedding_model import EmbeddingModel
from .faiss_manager import FAISSManager

class Retriever:
    """Retrieves relevant document chunks for a query using FAISS."""

    def __init__(self, similarity_threshold=0.50):
        self.faiss_manager = FAISSManager()
        self.embedding_model = EmbeddingModel
        self.similarity_threshold = similarity_threshold
        self.is_loaded = self.faiss_manager.load()

    def retrieve(self, query, k=5):
        """Retrieve top-k relevant chunks for a query.

        Returns:
            list of dicts with keys: text, source, file_name, device_name,
                                     manufacturer, similarity_score, confidence_pct
        """
        if not self.is_loaded or self.faiss_manager.index_size() == 0:
            return []

        query_embedding = self.embedding_model.encode(query, normalize=True)
        distances, indices = self.faiss_manager.search(query_embedding, k=k)

        results = []
        for dist, idx in zip(distances, indices):
            if idx == -1:
                continue
            meta = self.faiss_manager.get_metadata(int(idx))
            if meta is None:
                continue
            confidence_pct = round(float(dist) * 100, 2)
            results.append({
                "text": meta.get("text", ""),
                "source": meta.get("source", "Unknown"),
                "file_name": meta.get("file_name", ""),
                "device_name": meta.get("device_name", ""),
                "manufacturer": meta.get("manufacturer", ""),
                "category": meta.get("category", ""),
                "similarity_score": round(float(dist), 4),
                "confidence_pct": confidence_pct
            })

        return results

    def has_high_confidence(self, results):
        """Check if the top result exceeds the similarity threshold."""
        if not results:
            return False
        return results[0]["similarity_score"] >= self.similarity_threshold
