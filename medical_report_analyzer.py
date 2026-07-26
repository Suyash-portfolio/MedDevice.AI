import os
import re
import io
import uuid
import json
import base64
import logging
import tempfile
from datetime import datetime

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

logger = logging.getLogger("MedDevice.AI.ReportAnalyzer")

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf'}
MAX_FILE_SIZE = 20 * 1024 * 1024

MEDICAL_ABBREVIATIONS = {
    "WBC": "White Blood Cells", "RBC": "Red Blood Cells", "Hb": "Hemoglobin",
    "HGB": "Hemoglobin", "HCT": "Hematocrit", "MCV": "Mean Corpuscular Volume",
    "MCH": "Mean Corpuscular Hemoglobin", "MCHC": "Mean Corpuscular Hemoglobin Concentration",
    "PLT": "Platelets", "BP": "Blood Pressure", "HR": "Heart Rate",
    "RR": "Respiratory Rate", "SpO2": "Oxygen Saturation", "BMI": "Body Mass Index",
    "ECG": "Electrocardiogram", "EEG": "Electroencephalogram", "MRI": "Magnetic Resonance Imaging",
    "CT": "Computed Tomography", "USG": "Ultrasonography", "CBC": "Complete Blood Count",
    "LFT": "Liver Function Test", "KFT": "Kidney Function Test", "RFT": "Renal Function Test",
    "TSH": "Thyroid Stimulating Hormone", "HDL": "High Density Lipoprotein",
    "LDL": "Low Density Lipoprotein", "VLDL": "Very Low Density Lipoprotein",
    "CRP": "C-Reactive Protein", "ESR": "Erythrocyte Sedimentation Rate",
    "SGOT": "Serum Glutamic Oxaloacetic Transaminase (AST)",
    "SGPT": "Serum Glutamic Pyruvic Transaminase (ALT)",
    "BUN": "Blood Urea Nitrogen", "ICU": "Intensive Care Unit", "CCU": "Coronary Care Unit",
    "NICU": "Neonatal Intensive Care Unit", "ER": "Emergency Room", "OT": "Operating Theatre"
}

DISEASE_KEYWORDS = [
    "diabetes", "hypertension", "anemia", "asthma", "pneumonia", "bronchitis",
    "tuberculosis", "hepatitis", "cirrhosis", "kidney disease", "thyroid disorder",
    "hyperthyroidism", "hypothyroidism", "cancer", "tumor", "infection",
    "sepsis", "arthritis", "osteoporosis", "cardiovascular disease", "heart disease",
    "stroke", "copd", "covid", "malaria", "dengue", "typhoid", "cholera",
    "ulcer", "gastritis", "migraine", "epilepsy", "alzheimer", "parkinson",
    "depression", "anxiety", "pulmonary", "cardiac", "renal", "hepatic",
    "leukemia", "lymphoma", "meningitis", "encephalitis", "pancreatitis",
    "appendicitis", "cholecystitis", "glomerulonephritis", "pyelonephritis"
]

SYMPTOM_KEYWORDS = [
    "fever", "cough", "cold", "headache", "chest pain", "shortness of breath",
    "fatigue", "weakness", "nausea", "vomiting", "diarrhea", "constipation",
    "dizziness", "fainting", "seizure", "weight loss", "weight gain",
    "loss of appetite", "abdominal pain", "back pain", "joint pain",
    "muscle pain", "swelling", "rash", "itching", "bleeding", "bruising",
    "palpitations", "sweating", "chills", "numbness", "tingling",
    "blurred vision", "hearing loss", "tinnitus", "insomnia", "anxiety",
    "confusion", "memory loss", "difficulty swallowing", "hoarseness",
    "jaundice", "pale skin", "frequent urination", "painful urination",
    "blood in urine", "blood in stool", "bloody sputum"
]

MEDICATION_KEYWORDS = [
    "aspirin", "metformin", "insulin", "atorvastatin", "lisinopril",
    "amlodipine", "omeprazole", "paracetamol", "ibuprofen", "antibiotics",
    "antihypertensive", "antidiabetic", "statin", "diuretic", "beta blocker",
    "ace inhibitor", "anticoagulant", "antidepressant", "corticosteroid",
    "vaccine", "chemotherapy", "immunosuppressant", "painkiller", "sedative"
]

PROCEDURE_KEYWORDS = [
    "biopsy", "endoscopy", "colonoscopy", "angiography", "echocardiogram",
    "stress test", "dialysis", "ventilation", "surgery", "transplant",
    "catheterization", "blood transfusion", "radiation therapy", "mri scan",
    "ct scan", "x-ray", "ultrasound", "mammography", "colonoscopy"
]

ORGAN_KEYWORDS = [
    "heart", "lung", "liver", "kidney", "brain", "stomach", "intestine",
    "pancreas", "thyroid", "spleen", "bladder", "gallbladder", "uterus",
    "ovary", "prostate", "breast", "colon", "spine", "bone", "skin", "eye",
    "ear", "liver", "kidneys", "lungs", "artery", "vein", "nerve", "muscle"
]

RISK_INDICATORS = {
    "critical": ["emergency", "immediate", "urgent", "severe", "critical", "life-threatening"],
    "high": ["abnormal", "elevated", "significantly", "high risk", "positive", "malignant"],
    "moderate": ["moderate", "borderline", "mildly elevated", "slightly abnormal"],
    "low": ["normal", "within range", "negative", "stable", "mild", "minor"]
}

DEVICE_MAPPING = {
    "ecg": {"name": "ECG Machine", "purpose": "Records electrical activity of the heart", "risk": "Low"},
    "heart": {"name": "ECG Machine", "purpose": "Monitors cardiac electrical activity", "risk": "Low"},
    "cardiac": {"name": "ECG Machine", "purpose": "Cardiac monitoring and diagnosis", "risk": "Low"},
    "blood pressure": {"name": "Blood Pressure Monitor", "purpose": "Measures blood pressure", "risk": "Low"},
    "hypertension": {"name": "Blood Pressure Monitor", "purpose": "Monitors blood pressure levels", "risk": "Low"},
    "bp": {"name": "Blood Pressure Monitor", "purpose": "Non-invasive blood pressure measurement", "risk": "Low"},
    "oxygen": {"name": "Pulse Oximeter", "purpose": "Measures blood oxygen saturation", "risk": "Low"},
    "spo2": {"name": "Pulse Oximeter", "purpose": "Oxygen saturation monitoring", "risk": "Low"},
    "respiratory": {"name": "Pulse Oximeter", "purpose": "Monitors respiratory function", "risk": "Low"},
    "diabetes": {"name": "Glucometer", "purpose": "Measures blood glucose levels", "risk": "Low"},
    "sugar": {"name": "Glucometer", "purpose": "Blood glucose monitoring", "risk": "Low"},
    "glucose": {"name": "Glucometer", "purpose": "Blood sugar level testing", "risk": "Low"},
    "ultrasound": {"name": "Ultrasound Machine", "purpose": "Produces images using sound waves", "risk": "Low"},
    "pregnancy": {"name": "Ultrasound Machine", "purpose": "Fetal and abdominal imaging", "risk": "Low"},
    "x-ray": {"name": "X-Ray Machine", "purpose": "Produces radiographic images", "risk": "Low"},
    "fracture": {"name": "X-Ray Machine", "purpose": "Bone and chest imaging", "risk": "Low"},
    "chest": {"name": "X-Ray Machine", "purpose": "Chest radiography", "risk": "Low"},
    "ct scan": {"name": "CT Scanner", "purpose": "Cross-sectional body imaging", "risk": "Moderate"},
    "mri": {"name": "MRI Scanner", "purpose": "Detailed soft tissue imaging", "risk": "Moderate"},
    "ventilator": {"name": "Ventilator", "purpose": "Mechanical breathing support", "risk": "High"},
    "ventilation": {"name": "Ventilator", "purpose": "Respiratory support device", "risk": "High"},
    "infusion": {"name": "Infusion Pump", "purpose": "Delivers fluids and medications", "risk": "Moderate"},
    "iv": {"name": "Infusion Pump", "purpose": "Intravenous fluid delivery", "risk": "Moderate"},
    "defibrillator": {"name": "Defibrillator", "purpose": "Delivers electrical shock to restore heart rhythm", "risk": "High"},
    "cardiac arrest": {"name": "Defibrillator", "purpose": "Emergency cardiac resuscitation", "risk": "High"},
    "patient monitor": {"name": "Patient Monitor", "purpose": "Continuous vital signs monitoring", "risk": "Moderate"},
    "vital signs": {"name": "Patient Monitor", "purpose": "Multi-parameter vital signs monitoring", "risk": "Moderate"},
    "syringe": {"name": "Syringe Pump", "purpose": "Precise medication delivery", "risk": "Moderate"},
    "blood test": {"name": "Blood Analyzer", "purpose": "Analyzes blood samples", "risk": "Low"},
    "cbc": {"name": "Blood Analyzer", "purpose": "Complete blood count analysis", "risk": "Low"},
    "hemoglobin": {"name": "Blood Analyzer", "purpose": "Hemoglobin level measurement", "risk": "Low"},
    "spirometer": {"name": "Spirometer", "purpose": "Measures lung function", "risk": "Low"},
    "lung": {"name": "Spirometer", "purpose": "Pulmonary function testing", "risk": "Low"},
    "pulmonary": {"name": "Spirometer / Ventilator", "purpose": "Lung function assessment", "risk": "Moderate"}
}

NORMAL_RANGES = {
    "hemoglobin": {"unit": "g/dL", "male": (13.5, 17.5), "female": (12.0, 16.0), "label": "Hemoglobin (Hb)"},
    "wbc": {"unit": "cells/\u00b5L", "range": (4000, 11000), "label": "White Blood Cells (WBC)"},
    "rbc": {"unit": "million/\u00b5L", "male": (4.7, 6.1), "female": (4.2, 5.4), "label": "Red Blood Cells (RBC)"},
    "platelets": {"unit": "/\u00b5L", "range": (150000, 450000), "label": "Platelets (PLT)"},
    "blood_sugar": {"unit": "mg/dL", "fasting": (70, 110), "random": (70, 140), "label": "Blood Sugar"},
    "creatinine": {"unit": "mg/dL", "range": (0.6, 1.2), "label": "Creatinine"},
    "cholesterol": {"unit": "mg/dL", "desirable": "<200", "label": "Total Cholesterol"},
    "hdl": {"unit": "mg/dL", "range": (40, 60), "label": "HDL Cholesterol"},
    "ldl": {"unit": "mg/dL", "desirable": "<100", "label": "LDL Cholesterol"},
    "triglycerides": {"unit": "mg/dL", "desirable": "<150", "label": "Triglycerides"},
    "bun": {"unit": "mg/dL", "range": (7, 20), "label": "Blood Urea Nitrogen (BUN)"},
    "uric_acid": {"unit": "mg/dL", "male": (3.4, 7.0), "female": (2.4, 6.0), "label": "Uric Acid"},
    "sgpt_alt": {"unit": "U/L", "range": (10, 40), "label": "SGPT (ALT)"},
    "sgot_ast": {"unit": "U/L", "range": (10, 40), "label": "SGOT (AST)"},
    "alkaline_phosphatase": {"unit": "U/L", "range": (44, 147), "label": "Alkaline Phosphatase"},
    "bilirubin": {"unit": "mg/dL", "range": (0.1, 1.2), "label": "Bilirubin"},
    "total_protein": {"unit": "g/dL", "range": (6.0, 8.3), "label": "Total Protein"},
    "albumin": {"unit": "g/dL", "range": (3.5, 5.0), "label": "Albumin"},
    "sodium": {"unit": "mEq/L", "range": (135, 145), "label": "Sodium (Na)"},
    "potassium": {"unit": "mEq/L", "range": (3.5, 5.1), "label": "Potassium (K)"},
    "chloride": {"unit": "mEq/L", "range": (96, 106), "label": "Chloride (Cl)"},
    "calcium": {"unit": "mg/dL", "range": (8.5, 10.5), "label": "Calcium"},
    "tsh": {"unit": "mIU/L", "range": (0.4, 4.0), "label": "TSH"},
    "crp": {"unit": "mg/L", "range": (0, 10), "label": "C-Reactive Protein (CRP)"},
    "esr": {"unit": "mm/hr", "male": (0, 22), "female": (0, 29), "label": "ESR"},
    "temperature": {"unit": "\u00b0F", "range": (97.0, 99.5), "label": "Temperature"},
    "heart_rate": {"unit": "bpm", "range": (60, 100), "label": "Heart Rate"},
    "respiratory_rate": {"unit": "/min", "range": (12, 20), "label": "Respiratory Rate"},
    "oxygen_saturation": {"unit": "%", "range": (95, 100), "label": "Oxygen Saturation (SpO2)"}
}

def allowed_file(filename):
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def preprocess_image(image):
    try:
        img = image.convert('L')
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        img = img.filter(ImageFilter.SHARPEN)
        img = img.point(lambda x: 0 if x < 128 else 255, '1')
        return img
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}")
        return image

def extract_text_from_image(image_path):
    try:
        img = Image.open(image_path)
        processed = preprocess_image(img)
        text = pytesseract.image_to_string(processed, config='--psm 6 --oem 3')
        if not text.strip():
            text = pytesseract.image_to_string(img, config='--psm 6 --oem 3')
        return text.strip()
    except Exception as e:
        logger.error(f"OCR extraction failed for {image_path}: {e}")
        return ""

def extract_text_from_pdf(pdf_path):
    try:
        from pdf2image import convert_from_path
        poppler_path = r"C:\Users\Suyash\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin"
        images = convert_from_path(pdf_path, dpi=300, poppler_path=poppler_path)
        full_text = []
        for i, img in enumerate(images):
            processed = preprocess_image(img)
            text = pytesseract.image_to_string(processed, config='--psm 6 --oem 3')
            full_text.append(text.strip())
        return '\n'.join(full_text)
    except ImportError:
        logger.error("pdf2image not installed")
        return ""
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return ""

def extract_text(file_path, file_type):
    if file_type == 'pdf':
        return extract_text_from_pdf(file_path)
    else:
        return extract_text_from_image(file_path)

def clean_text(text):
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s.,;:()%\/\-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_medical_keywords(text):
    if not text:
        return {"diseases": [], "symptoms": [], "medications": [], "procedures": [], "organs": [], "abbreviations": []}

    text_lower = text.lower()
    result = {
        "diseases": [],
        "symptoms": [],
        "medications": [],
        "procedures": [],
        "organs": [],
        "abbreviations": []
    }

    for disease in DISEASE_KEYWORDS:
        if disease in text_lower:
            result["diseases"].append(disease.title())

    for symptom in SYMPTOM_KEYWORDS:
        if symptom in text_lower:
            result["symptoms"].append(symptom.title())

    for med in MEDICATION_KEYWORDS:
        if med in text_lower:
            result["medications"].append(med.title())

    for proc in PROCEDURE_KEYWORDS:
        if proc in text_lower:
            result["procedures"].append(proc.title())

    for organ in ORGAN_KEYWORDS:
        if organ in text_lower:
            result["organs"].append(organ.title())

    for abbr, full in MEDICAL_ABBREVIATIONS.items():
        if abbr.lower() in text_lower:
            result["abbreviations"].append(f"{abbr} ({full})")

    for key in result:
        result[key] = list(set(result[key]))
        if full_name := DISEASE_SYNONYMS.get(key.lower()):
            pass

    return result

DISEASE_SYNONYMS = {
    "high blood pressure": "Hypertension",
    "low blood pressure": "Hypotension",
    "high blood sugar": "Hyperglycemia",
    "low blood sugar": "Hypoglycemia",
    "heart attack": "Myocardial Infarction",
    "stroke": "Cerebrovascular Accident (CVA)",
    "kidney failure": "Renal Failure",
    "liver failure": "Hepatic Failure",
    "lung infection": "Pneumonia",
    "urinary tract infection": "UTI",
    "uti": "Urinary Tract Infection",
    "copd": "Chronic Obstructive Pulmonary Disease",
    "ckd": "Chronic Kidney Disease",
    "afib": "Atrial Fibrillation"
}

def extract_medical_values(text):
    if not text:
        return []

    text_lower = text.lower()
    values = []

    patterns = [
        ("hemoglobin", r'(?:hemoglobin|hb|hgb)\s*:?\s*(\d+\.?\d*)', "hemoglobin"),
        ("wbc", r'(?:wbc|white blood cell|total leucocyte count|tlc)\s*:?\s*(\d+(?:,\d+)?(?:\.\d+)?)', "wbc"),
        ("rbc", r'(?:rbc|red blood cell)\s*:?\s*(\d+\.?\d*)', "rbc"),
        ("platelets", r'(?:platelet|plt|thrombocyte)\s*:?\s*(\d+(?:,\d+)?(?:\.\d+)?)', "platelets"),
        ("blood_sugar", r'(?:blood sugar|glucose|blood glucose|fasting sugar|random sugar)\s*:?\s*(\d+\.?\d*)', "blood_sugar"),
        ("creatinine", r'(?:creatinine|creat|serum creatinine)\s*:?\s*(\d+\.?\d*)', "creatinine"),
        ("cholesterol", r'(?:cholesterol|total cholesterol|serum cholesterol)\s*:?\s*(\d+\.?\d*)', "cholesterol"),
        ("hdl", r'(?:hdl|hdl cholesterol|good cholesterol)\s*:?\s*(\d+\.?\d*)', "hdl"),
        ("ldl", r'(?:ldl|ldl cholesterol|bad cholesterol)\s*:?\s*(\d+\.?\d*)', "ldl"),
        ("triglycerides", r'(?:triglyceride|triglycerides|tgl)\s*:?\s*(\d+\.?\d*)', "triglycerides"),
        ("bun", r'(?:bun|blood urea nitrogen|blood urea)\s*:?\s*(\d+\.?\d*)', "bun"),
        ("uric_acid", r'(?:uric acid|serum uric acid|urate)\s*:?\s*(\d+\.?\d*)', "uric_acid"),
        ("sgpt_alt", r'(?:sgpt|alt|alanine transaminase|alanine aminotransferase)\s*:?\s*(\d+\.?\d*)', "sgpt_alt"),
        ("sgot_ast", r'(?:sgot|ast|aspartate transaminase|aspartate aminotransferase)\s*:?\s*(\d+\.?\d*)', "sgot_ast"),
        ("alkaline_phosphatase", r'(?:alkaline phosphatase|alp|alk phos)\s*:?\s*(\d+\.?\d*)', "alkaline_phosphatase"),
        ("bilirubin", r'(?:bilirubin|total bilirubin|serum bilirubin)\s*:?\s*(\d+\.?\d*)', "bilirubin"),
        ("total_protein", r'(?:total protein|serum protein)\s*:?\s*(\d+\.?\d*)', "total_protein"),
        ("albumin", r'(?:albumin|serum albumin)\s*:?\s*(\d+\.?\d*)', "albumin"),
        ("sodium", r'(?:sodium|na\+|na)\s*:?\s*(\d+\.?\d*)', "sodium"),
        ("potassium", r'(?:potassium|k\+|k)\s*:?\s*(\d+\.?\d*)', "potassium"),
        ("chloride", r'(?:chloride|cl\-|cl)\s*:?\s*(\d+\.?\d*)', "chloride"),
        ("calcium", r'(?:calcium|ca\+{2}|ca)\s*:?\s*(\d+\.?\d*)', "calcium"),
        ("tsh", r'(?:tsh|thyroid stimulating hormone|thyrotropin)\s*:?\s*(\d+\.?\d*)', "tsh"),
        ("crp", r'(?:crp|c-reactive protein|c reactive protein)\s*:?\s*(\d+\.?\d*)', "crp"),
        ("esr", r'(?:esr|erythrocyte sedimentation rate|sed rate)\s*:?\s*(\d+\.?\d*)', "esr"),
        ("temperature", r'(?:temperature|temp|body temp)\s*:?\s*(\d+\.?\d*)', "temperature"),
        ("heart_rate", r'(?:heart rate|pulse|hr|pulse rate)\s*:?\s*(\d+)', "heart_rate"),
        ("respiratory_rate", r'(?:respiratory rate|rr|respiration|resp rate)\s*:?\s*(\d+)', "respiratory_rate"),
        ("oxygen_saturation", r'(?:oxygen saturation|spo2|o2 sat|oxygen sat)\s*:?\s*(\d+)', "oxygen_saturation"),
    ]

    for param_name, pattern, range_key in patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            try:
                raw_value = match.replace(',', '')
                value = float(raw_value)
                range_info = NORMAL_RANGES.get(range_key, {})
                unit = range_info.get("unit", "")
                label = range_info.get("label", param_name.title())
                is_abnormal = False
                status = "Normal"

                if "range" in range_info:
                    r = range_info["range"]
                    if not (r[0] <= value <= r[1]):
                        is_abnormal = True
                        status = "High" if value > r[1] else "Low"

                entry = {
                    "name": label,
                    "value": raw_value,
                    "unit": unit,
                    "normal_range": str(range_info.get("range", "")),
                    "status": status,
                    "is_abnormal": is_abnormal
                }
                values.append(entry)
            except (ValueError, IndexError):
                continue

    if "blood pressure" in text_lower:
        bp_match = re.search(r'(?:blood pressure|bp)\s*:?\s*(\d+)\s*[\/\-]\s*(\d+)', text_lower)
        if bp_match:
            systolic = int(bp_match.group(1))
            diastolic = int(bp_match.group(2))
            bp_status = "Normal"
            if systolic >= 140 or diastolic >= 90:
                bp_status = "High"
            elif systolic >= 130 or diastolic >= 80:
                bp_status = "Borderline High"
            values.append({
                "name": "Blood Pressure (BP)",
                "value": f"{systolic}/{diastolic}",
                "unit": "mmHg",
                "normal_range": "<120/80",
                "status": bp_status,
                "is_abnormal": bp_status != "Normal"
            })

    return values

def recommend_devices(keywords, devices_df):
    recommended = []
    keywords_text = ' '.join(keywords.get("diseases", [])).lower() + ' '
    keywords_text += ' '.join(keywords.get("symptoms", [])).lower() + ' '
    keywords_text += ' '.join(keywords.get("organs", [])).lower() + ' '
    keywords_text += ' '.join(keywords.get("procedures", [])).lower()
    keywords_text += ' ' + ' '.join(keywords.get("abbreviations", [])).lower()

    matched_keys = set()
    for trigger_key, device_info in DEVICE_MAPPING.items():
        if trigger_key in keywords_text:
            if device_info["name"] not in matched_keys:
                matched_keys.add(device_info["name"])
                recommended.append({
                    "name": device_info["name"],
                    "purpose": device_info["purpose"],
                    "relevance": f"Recommended for: {', '.join(k for k in keywords.get('diseases', []) + keywords.get('symptoms', []) + keywords.get('organs', []) if trigger_key in k.lower()) or trigger_key.title()}",
                    "clinical_use": f"Used for {device_info['purpose'].lower()} in clinical settings",
                    "risk_level": device_info["risk"]
                })

    if not recommended and devices_df is not None and not devices_df.empty:
        device_names = devices_df['device_name'].unique()
        for d in device_names[:5]:
            recommended.append({
                "name": str(d),
                "purpose": "General medical diagnostic and monitoring device",
                "relevance": "General relevance based on available device database",
                "clinical_use": "Standard clinical use",
                "risk_level": "Moderate"
            })

    return recommended

def assess_risk(keywords, medical_values):
    critical_count = 0
    high_count = 0
    moderate_count = 0

    for v in medical_values:
        if v.get("is_abnormal") and v.get("status") in ("High", "Low"):
            if v.get("name") in ("Heart Rate", "Oxygen Saturation", "Temperature"):
                if v.get("status") == "High":
                    high_count += 1
                else:
                    moderate_count += 1
            elif v.get("status") == "High":
                high_count += 1
            else:
                moderate_count += 1

    if "critical" in str(keywords).lower() or "emergency" in str(keywords).lower():
        critical_count += 1
    if "severe" in str(keywords).lower():
        high_count += 1

    for disease in keywords.get("diseases", []):
        if disease.lower() in ["heart attack", "stroke", "sepsis", "meningitis", "cancer"]:
            high_count += 1
        elif disease.lower() in ["diabetes", "hypertension", "asthma", "thyroid disorder"]:
            moderate_count += 1

    if critical_count > 0:
        return "High", "Critical values or emergency indicators detected. Immediate medical attention may be required."
    elif high_count >= 2:
        return "High", "Multiple abnormal values detected. Clinical evaluation recommended."
    elif high_count == 1:
        return "Moderate", "Some abnormal values detected. Medical consultation advised."
    elif moderate_count >= 2:
        return "Moderate", "Mildly abnormal findings. Routine follow-up suggested."
    else:
        return "Low", "All findings appear within normal ranges. Regular monitoring advised."

def generate_summary(text, keywords, medical_values, file_name):
    if not text:
        return "No text could be extracted from the report."

    word_count = len(text.split())
    summary_parts = []

    summary_parts.append(f"Medical report '{file_name}' has been analyzed. "
                         f"The document contains approximately {word_count} words of medical text.")

    if keywords.get("diseases"):
        diseases = keywords["diseases"]
        if len(diseases) == 1:
            summary_parts.append(f"The report mentions the condition: {diseases[0]}.")
        else:
            summary_parts.append(f"The report mentions conditions: {', '.join(diseases)}.")

    if keywords.get("symptoms"):
        symptoms = keywords["symptoms"]
        if len(symptoms) <= 3:
            summary_parts.append(f"Reported symptoms include: {', '.join(symptoms)}.")
        else:
            summary_parts.append(f"Multiple symptoms reported including: {', '.join(symptoms[:4])} and {len(symptoms)-4} others.")

    if keywords.get("organs"):
        summary_parts.append(f"Body systems/organ mentions include: {', '.join(keywords['organs'][:5])}.")

    if keywords.get("procedures"):
        summary_parts.append(f"Procedures mentioned: {', '.join(keywords['procedures'][:3])}.")

    abnormal_values = [v for v in medical_values if v.get("is_abnormal")]
    if abnormal_values:
        abnormal_strs = []
        for v in abnormal_values[:5]:
            abnormal_strs.append("{} ({}{})".format(v.get("name",""), v.get("value",""), v.get("unit","")))
        summary_parts.append("Found {} abnormal value(s) including: {}.".format(
            len(abnormal_values), ", ".join(abnormal_strs)))
    else:
        summary_parts.append("All detected values appear within expected normal ranges.")

    summary_parts.append("This analysis is based solely on the extracted text and is not a clinical diagnosis. "
                         "Please consult a qualified healthcare professional for interpretation.")

    return ' '.join(summary_parts)

def generate_recommendations(keywords, risk_level, medical_values):
    recs = []

    if risk_level in ("High", "Moderate"):
        recs.append("Seek immediate medical consultation with a qualified healthcare professional.")

    recs.append("Share this report analysis with your physician for proper clinical interpretation.")

    if medical_values:
        abnormal = [v for v in medical_values if v.get("is_abnormal")]
        if abnormal:
            recs.append("Repeat laboratory tests as advised by your doctor to track changes.")
            param_names = [v["name"] for v in abnormal[:3]]
            recs.append(f"Pay special attention to: {', '.join(param_names)} levels.")

    recs.append("Monitor vital signs regularly as recommended by your healthcare provider.")

    if keywords.get("medications"):
        recs.append("Continue prescribed medications as directed. Do not modify dosage without consulting your doctor.")

    if "fever" in str(keywords.get("symptoms", [])).lower() or "infection" in str(keywords.get("diseases", [])).lower():
        recs.append("Maintain hydration and adequate rest.")

    recs.append("Maintain a healthy diet and lifestyle as advised by your nutritionist or physician.")

    if risk_level == "High":
        recs.append("If you experience severe symptoms such as chest pain, difficulty breathing, or loss of consciousness, seek emergency medical attention immediately.")

    recs.append("This is an AI-generated analysis for informational purposes only. It does not replace professional medical advice, diagnosis, or treatment.")

    return recs

def generate_possible_conditions(keywords):
    conditions = []
    for disease in keywords.get("diseases", []):
        if disease.lower() in DISEASE_SYNONYMS:
            display = DISEASE_SYNONYMS[disease.lower()]
        else:
            display = disease

        condition_entry = {
            "condition": display,
            "note": "Mentioned or suggested in the report text"
        }
        conditions.append(condition_entry)

    if not conditions:
        conditions.append({
            "condition": "No specific medical conditions identified",
            "note": "The report text does not clearly indicate any specific condition. Further clinical evaluation is recommended."
        })

    return conditions

def analyze_report(file_path, file_name, file_type, devices_df):
    logger.info(f"Starting analysis for {file_name} (type: {file_type})")

    try:
        raw_text = extract_text(file_path, file_type)
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        return {"status": "error", "message": f"Failed to extract text from the report: {str(e)}"}

    if not raw_text or not raw_text.strip():
        return {"status": "error", "message": "No readable text could be extracted from the uploaded report. The file may be a scanned image without clear text, or the format may not be supported."}

    cleaned = clean_text(raw_text)
    keywords = extract_medical_keywords(cleaned)
    medical_values = extract_medical_values(cleaned)
    risk_level, risk_description = assess_risk(keywords, medical_values)
    summary = generate_summary(raw_text, keywords, medical_values, file_name)
    recommendations = generate_recommendations(keywords, risk_level, medical_values)
    possible_conditions = generate_possible_conditions(keywords)
    devices = recommend_devices(keywords, devices_df)

    result = {
        "status": "success",
        "file_name": file_name,
        "file_type": file_type,
        "extracted_text": raw_text,
        "word_count": len(raw_text.split()),
        "analysis": {
            "summary": summary,
            "possible_conditions": possible_conditions,
            "medical_values": medical_values,
            "symptoms": keywords.get("symptoms", []),
            "keywords": {
                "diseases": keywords.get("diseases", []),
                "symptoms": keywords.get("symptoms", []),
                "medications": keywords.get("medications", []),
                "procedures": keywords.get("procedures", []),
                "organs": keywords.get("organs", []),
                "abbreviations": keywords.get("abbreviations", [])
            },
            "recommended_devices": devices,
            "risk_level": risk_level,
            "risk_description": risk_description,
            "recommendations": recommendations
        },
        "disclaimer": "This analysis is AI-generated for informational purposes only. It is not a clinical diagnosis and should be reviewed by a qualified healthcare professional."
    }

    logger.info(f"Analysis complete for {file_name}: {len(raw_text.split())} words, {len(devices)} devices recommended, risk={risk_level}")
    return result

def generate_pdf_report(analysis_result):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import inch
    except ImportError:
        return None

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=18, spaceAfter=20)
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, spaceAfter=10)
    normal_style = ParagraphStyle('CustomNormal', parent=styles['Normal'], fontSize=10, spaceAfter=6)
    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8, textColor=colors.gray, spaceAfter=10)

    story.append(Paragraph("Medical Report Analysis", title_style))
    story.append(Spacer(1, 0.2*inch))

    if analysis_result.get("status") == "success":
        analysis = analysis_result.get("analysis", {})
        story.append(Paragraph(f"File: {analysis_result.get('file_name', 'Unknown')}", normal_style))
        story.append(Paragraph(f"Word Count: {analysis_result.get('word_count', 0)} words", normal_style))
        story.append(Spacer(1, 0.15*inch))

        story.append(Paragraph("Report Summary", heading_style))
        story.append(Paragraph(analysis.get("summary", "No summary available"), normal_style))
        story.append(Spacer(1, 0.15*inch))

        conditions = analysis.get("possible_conditions", [])
        if conditions:
            story.append(Paragraph("Possible Medical Conditions", heading_style))
            for c in conditions:
                story.append(Paragraph(f"&bull; {c.get('condition', '')} - {c.get('note', '')}", normal_style))
            story.append(Spacer(1, 0.15*inch))

        values = analysis.get("medical_values", [])
        if values:
            story.append(Paragraph("Important Medical Values", heading_style))
            table_data = [["Parameter", "Value", "Normal Range", "Status"]]
            for v in values:
                status = v.get("status", "")
                status_display = f'{status} {"*" if v.get("is_abnormal") else ""}'
                table_data.append([v.get("name", ""), f'{v.get("value", "")} {v.get("unit", "")}', v.get("normal_range", ""), status_display])
            t = Table(table_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1*inch])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.1, 0.3, 0.6)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            for i, row in enumerate(table_data[1:], 1):
                if row[3] and row[3] != "Normal":
                    t.setStyle(TableStyle([('BACKGROUND', (0, i), (-1, i), colors.Color(1, 0.9, 0.9))]))
            story.append(t)
            story.append(Spacer(1, 0.15*inch))

        symptoms = analysis.get("symptoms", [])
        if symptoms:
            story.append(Paragraph("Symptoms Identified", heading_style))
            story.append(Paragraph(', '.join(symptoms), normal_style))
            story.append(Spacer(1, 0.1*inch))

        devices = analysis.get("recommended_devices", [])
        if devices:
            story.append(Paragraph("Recommended Medical Devices", heading_style))
            device_data = [["Device", "Purpose", "Risk Level"]]
            for d in devices:
                device_data.append([d.get("name", ""), d.get("purpose", ""), d.get("risk_level", "")])
            dt = Table(device_data, colWidths=[1.5*inch, 3*inch, 1*inch])
            dt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.1, 0.3, 0.6)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(dt)
            story.append(Spacer(1, 0.15*inch))

        story.append(Paragraph(f"Risk Level: {analysis.get('risk_level', 'Unknown')}", heading_style))
        story.append(Paragraph(analysis.get("risk_description", ""), normal_style))
        story.append(Spacer(1, 0.15*inch))

        story.append(Paragraph("Recommendations", heading_style))
        for rec in analysis.get("recommendations", []):
            story.append(Paragraph(f"&bull; {rec}", normal_style))
    else:
        story.append(Paragraph(f"Analysis failed: {analysis_result.get('message', 'Unknown error')}", normal_style))

    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Disclaimer", ParagraphStyle('DisclaimerHeading', parent=styles['Heading3'], fontSize=10, textColor=colors.gray)))
    story.append(Paragraph("This report is AI-generated for informational purposes only. It is not a clinical diagnosis and should be reviewed by a qualified healthcare professional. The analysis is based solely on the text extracted from the uploaded medical report.", disclaimer_style))

    doc.build(story)
    buffer.seek(0)
    return buffer
