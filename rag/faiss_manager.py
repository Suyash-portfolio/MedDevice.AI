import os
import pickle
import numpy as np
import faiss

class FAISSManager:
    """Manages FAISS vector index for similarity search."""

    def __init__(self, index_dir=None):
        if index_dir is None:
            base = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'knowledge_base')
            index_dir = os.path.join(base, 'faiss_index')
        self.index_dir = index_dir
        os.makedirs(self.index_dir, exist_ok=True)
        self.index_path = os.path.join(self.index_dir, 'faiss_index.bin')
        self.metadata_path = os.path.join(self.index_dir, 'metadata.pkl')
        self.index = None
        self.metadata = []

    def build_index(self, embeddings, metadata_list):
        """Build a FAISS index from embeddings and store metadata."""
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)
        self.index.add(embeddings)
        self.metadata = list(metadata_list)
        self.save()

    def save(self):
        """Save FAISS index and metadata to disk."""
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
        with open(self.metadata_path, 'wb') as f:
            pickle.dump(self.metadata, f)

    def load(self):
        """Load FAISS index and metadata from disk."""
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.metadata_path, 'rb') as f:
                self.metadata = pickle.load(f)
            return True
        return False

    def search(self, query_embedding, k=5):
        """Search the index for top-k similar vectors."""
        if self.index is None or self.index.ntotal == 0:
            return [], []
        query_embedding = np.array(query_embedding, dtype=np.float32)
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        distances, indices = self.index.search(query_embedding, k)
        return distances[0], indices[0]

    def get_metadata(self, idx):
        """Get metadata for a given index."""
        if 0 <= idx < len(self.metadata):
            return self.metadata[idx]
        return None

    def index_size(self):
        """Return the number of vectors in the index."""
        if self.index is not None:
            return self.index.ntotal
        return 0
