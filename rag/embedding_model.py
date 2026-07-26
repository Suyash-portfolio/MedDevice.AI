import numpy as np

class EmbeddingModel:
    """Wrapper for SentenceTransformer embedding model with lazy loading."""

    _model = None
    _model_name = "all-MiniLM-L6-v2"

    @classmethod
    def get_model(cls):
        """Lazy-load the SentenceTransformer model (singleton)."""
        if cls._model is None:
            from sentence_transformers import SentenceTransformer
            cls._model = SentenceTransformer(cls._model_name)
        return cls._model

    @classmethod
    def encode(cls, texts, normalize=True):
        """Encode texts into embeddings. Returns numpy array."""
        model = cls.get_model()
        if isinstance(texts, str):
            texts = [texts]
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=normalize)
        return np.array(embeddings, dtype=np.float32)

    @classmethod
    def embedding_dimension(cls):
        """Return the dimension of embeddings for this model."""
        return 384

    @classmethod
    def clear_cache(cls):
        """Clear the cached model (useful for memory management)."""
        cls._model = None
