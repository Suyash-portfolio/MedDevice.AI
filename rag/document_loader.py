import os
import pandas as pd

class DocumentLoader:
    """Loads documents from multiple sources for RAG indexing."""

    def __init__(self, base_dir=None):
        if base_dir is None:
            base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'knowledge_base')
        self.base_dir = base_dir
        self.csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'medical_devices.csv')

    def load_csv(self):
        """Load medical_devices.csv and return document dicts."""
        docs = []
        if not os.path.exists(self.csv_path):
            return docs
        df = pd.read_csv(self.csv_path)
        for idx, row in df.iterrows():
            question = str(row.get('Question', '')).strip()
            answer = str(row.get('Answer', '')).strip()
            if not answer:
                continue
            device_name = self._extract_field(answer, 'Device')
            manufacturer = self._extract_field(answer, 'Manufacturer')
            text = f"Question: {question}\nAnswer: {answer}" if question else answer
            docs.append({
                "text": text,
                "source": "Device Dataset",
                "file_name": "medical_devices.csv",
                "device_name": device_name or "Unknown",
                "manufacturer": manufacturer or "Unknown",
                "category": "",
                "row_id": idx
            })
        return docs

    def load_pdfs_from_dir(self, directory, source_label):
        """Load all PDFs from a directory and return document dicts."""
        docs = []
        if not os.path.isdir(directory):
            return docs
        for fname in os.listdir(directory):
            if fname.lower().endswith('.pdf'):
                fpath = os.path.join(directory, fname)
                try:
                    text = self._extract_pdf_text(fpath)
                    if text.strip():
                        docs.append({
                            "text": text,
                            "source": source_label,
                            "file_name": fname,
                            "device_name": "",
                            "manufacturer": "",
                            "category": ""
                        })
                except Exception:
                    pass
        return docs

    def load_all(self):
        """Load all documents from all sources."""
        docs = []
        docs.extend(self.load_csv())
        docs.extend(self.load_pdfs_from_dir(
            os.path.join(self.base_dir, 'manuals'), 'Medical Device Manual'))
        docs.extend(self.load_pdfs_from_dir(
            os.path.join(self.base_dir, 'brochures'), 'Device Brochure'))
        docs.extend(self.load_pdfs_from_dir(
            os.path.join(self.base_dir, 'guidelines'), 'Clinical Guideline'))
        docs.extend(self.load_pdfs_from_dir(
            os.path.join(self.base_dir, 'uploaded_reports'), 'Uploaded Report'))
        return docs

    @staticmethod
    def _extract_pdf_text(filepath):
        """Extract text from a PDF file."""
        text_parts = []
        try:
            import pdfplumber
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text_parts.append(t)
        except Exception:
            try:
                import PyPDF2
                with open(filepath, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        t = page.extract_text()
                        if t:
                            text_parts.append(t)
            except Exception:
                pass
        return "\n".join(text_parts)

    @staticmethod
    def _extract_field(answer, field_name):
        """Extract a field value from the CSV answer format (e.g. 'Device: XYZ | ...')."""
        import re
        match = re.search(rf'{re.escape(field_name)}:\s*([^|]+)', answer)
        if match:
            return match.group(1).strip()
        return ""
