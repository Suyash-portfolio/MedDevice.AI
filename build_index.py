"""
Background indexing script for the RAG system.

Rebuilds the FAISS index from all knowledge base sources (CSV + PDFs).
Run this whenever new documents are added to knowledge_base/.

Usage:
    python build_index.py              # Full rebuild
    python build_index.py --verbose    # Show detailed progress
"""
import os
import sys
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_DIR)

from rag.document_loader import DocumentLoader
from rag.text_splitter import TextSplitter
from rag.embedding_model import EmbeddingModel
from rag.faiss_manager import FAISSManager


def rebuild_index(verbose=False):
    """Rebuild the entire FAISS index from all knowledge sources."""
    logger.info("Starting FAISS index rebuild...")

    loader = DocumentLoader()
    raw_docs = loader.load_all()
    logger.info(f"Loaded {len(raw_docs)} raw documents.")

    if not raw_docs:
        logger.warning("No documents found. Index will be empty.")
        return

    splitter = TextSplitter(chunk_size=700, chunk_overlap=100)
    chunks = splitter.split_documents(raw_docs)
    logger.info(f"Split into {len(chunks)} chunks.")

    if not chunks:
        logger.warning("No chunks generated. Index will be empty.")
        return

    texts = [c["text"] for c in chunks]
    logger.info(f"Generating embeddings for {len(texts)} chunks...")
    embeddings = EmbeddingModel.encode(texts, normalize=True)
    logger.info(f"Embeddings shape: {embeddings.shape}")

    faiss_manager = FAISSManager()
    faiss_manager.build_index(embeddings, chunks)
    logger.info(f"Index saved to {faiss_manager.index_dir}")
    logger.info(f"Total vectors in index: {faiss_manager.index_size()}")

    if verbose:
        source_counts = {}
        for c in chunks:
            src = c["source"]
            source_counts[src] = source_counts.get(src, 0) + 1
        logger.info("Chunks by source:")
        for src, count in sorted(source_counts.items()):
            logger.info(f"  {src}: {count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rebuild FAISS index for RAG system")
    parser.add_argument("--verbose", action="store_true", help="Show detailed progress")
    args = parser.parse_args()
    rebuild_index(verbose=args.verbose)
