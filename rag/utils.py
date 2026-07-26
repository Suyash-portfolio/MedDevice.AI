import re

def parse_csv_answer(answer_text):
    """Parse a CSV answer string into structured fields.

    Format: 'Device: XYZ | Manufacturer: ABC | ...'
    """
    fields = {
        "device_name": "",
        "manufacturer": "",
        "accuracy": "",
        "price": "",
        "detector_type": "",
        "applications": "",
        "features": "",
        "category": ""
    }
    for key in fields:
        match = re.search(rf'{re.escape(key.replace("_", " ").title())}:\s*([^|]+)', answer_text, re.IGNORECASE)
        if match:
            fields[key] = match.group(1).strip()
    if not fields["device_name"]:
        match = re.search(r'Device:\s*([^|]+)', answer_text)
        if match:
            fields["device_name"] = match.group(1).strip()
    return fields

def extract_device_from_chunk(chunk_text):
    """Extract device name from any chunk text."""
    match = re.search(r'Device:\s*([^|]+)', chunk_text)
    if match:
        return match.group(1).strip()
    for brand in ['GE', 'Philips', 'Siemens', 'Canon', 'Fujifilm', 'Schiller', 'BPL', 'Mindray', 'Nihon', 'Dräger']:
        bm = re.search(rf'{brand}\s+[\w\s/]+?(?:\s+has|\s+provides|\s+is|\s+costs|\s+uses|\s+are|\s+offers|\s+supports|,|\||$)', chunk_text)
        if bm:
            return bm.group(0).strip().rstrip(',').strip()
    return None

def format_rag_response(chunks):
    """Format retrieved chunks into a response string with source attribution."""
    if not chunks:
        return None, {}

    top = chunks[0]
    parsed = parse_csv_answer(top["text"])
    device = parsed.get("device_name") or top.get("device_name", "") or extract_device_from_chunk(top["text"]) or ""
    manufacturer = parsed.get("manufacturer") or top.get("manufacturer", "")

    answer_parts = [top["text"]]
    if len(chunks) > 1 and chunks[1]["similarity_score"] > 0.3:
        answer_parts.append(f"\n\n--- Additional Context ---\n{chunks[1]['text']}")

    answer = "\n".join(answer_parts)

    source_label_map = {
        "Device Dataset": "Device Dataset",
        "Medical Device Manual": "Medical Device Manual",
        "Device Brochure": "Device Brochure",
        "Clinical Guideline": "Clinical Guideline",
        "Uploaded Report": "Uploaded Report"
    }
    retrieved_from = source_label_map.get(top["source"], top["source"])

    metadata = {
        "device_name": device,
        "manufacturer": manufacturer,
        "retrieved_from": retrieved_from,
        "similarity_score": top["similarity_score"],
        "confidence_pct": top["confidence_pct"]
    }

    return answer, metadata
