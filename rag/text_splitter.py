class TextSplitter:
    """Splits documents into overlapping chunks for embedding."""

    def __init__(self, chunk_size=700, chunk_overlap=100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text):
        """Split a single text into overlapping chunks, respecting sentence boundaries."""
        if not text or len(text) <= self.chunk_size:
            return [text.strip()] if text and text.strip() else []

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunks.append(text[start:].strip())
                break

            sentence_end = self._find_sentence_boundary(text, end)
            if sentence_end == end or sentence_end <= start:
                sentence_end = end

            chunks.append(text[start:sentence_end].strip())
            start = sentence_end - self.chunk_overlap
            if start < 0:
                start = 0

        return [c for c in chunks if c]

    def split_documents(self, docs):
        """Split a list of document dicts into chunk dicts."""
        chunked = []
        for doc in docs:
            chunks = self.split_text(doc["text"])
            for i, chunk_text in enumerate(chunks):
                chunked.append({
                    "text": chunk_text,
                    "source": doc.get("source", "Unknown"),
                    "file_name": doc.get("file_name", ""),
                    "device_name": doc.get("device_name", ""),
                    "manufacturer": doc.get("manufacturer", ""),
                    "category": doc.get("category", ""),
                    "chunk_index": i
                })
        return chunked

    @staticmethod
    def _find_sentence_boundary(text, position):
        """Find the nearest sentence boundary near the given position."""
        search_window = text[max(0, position - 50):min(len(text), position + 50)]
        for sep in ['. ', '?\n', '!\n', '\n\n', '. \n']:
            idx = search_window.find(sep)
            if idx != -1:
                abs_idx = max(0, position - 50) + idx + len(sep)
                if abs_idx > position - 20:
                    return abs_idx
        for sep in ['.', '?', '!', '\n']:
            idx = search_window.find(sep)
            if idx != -1:
                abs_idx = max(0, position - 50) + idx + 1
                if abs_idx > position - 20:
                    return abs_idx
        return position
