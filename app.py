import os
import re
import time
import random
import uuid
import json
import logging
from datetime import datetime
from functools import wraps
import pandas as pd
from flask import Flask, request, jsonify, render_template, redirect, url_for, Response
from jose import jwt, JWTError
from supabase import create_client, Client
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(pathname)s:%(lineno)d \u2192 %(message)s'
)
logger = logging.getLogger("MedDevice.AI.Core")

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "fallback-dev-key-32-chars")

SUPABASE_URL = os.environ.get("SUPABASE_URL") or ""
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY") or ""
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET") or os.environ.get("JWT_SECRET") or ""

if not all([SUPABASE_URL, SUPABASE_ANON_KEY]):
    logger.warning("Supabase environment variables are missing; persistence features will be disabled.")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    except Exception as exc:
        logger.warning(f"Unable to initialize Supabase client: {exc}")
        supabase = None

@app.context_processor
def inject_supabase_config():
    return {
        "supabase_config": {
            "url": SUPABASE_URL,
            "anonKey": SUPABASE_ANON_KEY,
        }
    }

# --- MEDICAL DEVICE KNOWLEDGE BASE ---
# Uses direct TF-IDF question matching against the dataset.
# No hallucination: if no good match, the chatbot politely declines.
MEDICAL_DEVICE_KEYWORDS = [
    "medical device", "x-ray", "ct scan", "mri", "ultrasound", "ecg", "eeg", "emg",
    "ventilator", "defibrillator", "infusion pump", "syringe pump", "pulse oximeter",
    "glucometer", "blood pressure", "spirometer", "dialysis", "anesthesia",
    "endoscope", "colonoscope", "c-arm", "mammography", "pet scan", "bone densitometer",
    "incubator", "infant warmer", "surgical light", "autoclave", "centrifuge",
    "hematology", "biochemistry", "blood gas", "oxygen concentrator", "nebulizer",
    "suction machine", "wheelchair", "hospital bed", "dental", "ophthalmic",
    "ent equipment", "pcr", "elisa", "microscope", "patient monitor",
    "glucose", "hemoglobin", "cholesterol", "bp monitor", "stethoscope",
    "surgical", "diagnostic", "imaging", "price", "cost", "manufacturer",
    "accuracy", "application", "feature", "warranty", "maintenance", "calibration",
    "sterilization", "certification", "fda", "ce marking", "iso",
    "safety", "portable", "weight", "dimension", "battery", "connectivity",
    "dicom", "pacs", "hl7", "ai feature", "accessory", "consumable",
    "probe", "sensor", "electrode", "lifespan", "train", "install",
    "device", "machine", "equipment", "apparatus", "instrument",
    "telemedicine", "point-of-care", "iot healthcare", "difference between",
    "compare", "tell me about", "what is", "how does", "which", "best",
    "recommend", "hospital department", "icu", "nicu", "operation theatre",
    "emergency", "patient", "treatment", "diagnosis", "therapy", "monitor"
]

csv_path = os.path.join(os.path.dirname(__file__), 'medical_devices.csv')
QA_QUESTIONS = []
QA_ANSWERS = []
QA_VECTORIZER = None
QA_TFIDF_MATRIX = None
SIMILARITY_THRESHOLD = 0.25

def load_qa_dataset():
    global QA_QUESTIONS, QA_ANSWERS, QA_VECTORIZER, QA_TFIDF_MATRIX
    if not os.path.exists(csv_path):
        logger.error(f"Knowledge database missing at {csv_path}.")
        return

    df = pd.read_csv(csv_path)
    if 'Question' not in df.columns or 'Answer' not in df.columns:
        logger.error("CSV must have Question and Answer columns.")
        return

    df = df.dropna(subset=['Question', 'Answer'])
    QA_QUESTIONS = df['Question'].str.strip().tolist()
    QA_ANSWERS = df['Answer'].str.strip().tolist()

    vectorizer = TfidfVectorizer(stop_words='english', max_features=5000, ngram_range=(1, 2))
    tfidf_matrix = vectorizer.fit_transform(QA_QUESTIONS)
    QA_VECTORIZER = vectorizer
    QA_TFIDF_MATRIX = tfidf_matrix
    logger.info(f"Knowledge base loaded: {len(QA_QUESTIONS)} Q&A pairs.")

load_qa_dataset()

def _build_devices_df():
    names = []
    descs = []
    for i in range(len(QA_QUESTIONS)):
        q = QA_QUESTIONS[i]
        a = QA_ANSWERS[i]
        name = extract_device_name(a) or ""
        if not name and q.lower().startswith("tell me about"):
            name = q.replace("Tell me about", "", 1).strip()
        names.append(name)
        descs.append(a)
    return pd.DataFrame({"device_name": names, "description": descs})

def is_medical_device_query(query):
    query_lower = query.lower()
    for kw in MEDICAL_DEVICE_KEYWORDS:
        if kw in query_lower:
            return True
    return False

def hybrid_query(user_query):
    if not QA_VECTORIZER or QA_TFIDF_MATRIX is None or len(QA_QUESTIONS) == 0:
        return None, 0.0, None

    query_vec = QA_VECTORIZER.transform([user_query])
    sim_scores = cosine_similarity(query_vec, QA_TFIDF_MATRIX).flatten()
    best_idx = sim_scores.argsort()[-1]
    best_score = float(sim_scores[best_idx])

    if best_score >= SIMILARITY_THRESHOLD:
        return QA_ANSWERS[best_idx], best_score, "dataset"
    return None, best_score, None

# --- RAG PIPELINE ---
RAG_PIPELINE = None
try:
    from rag.rag_pipeline import RAGPipeline
    RAG_PIPELINE = RAGPipeline(similarity_threshold=0.50)
    RAG_PIPELINE.set_fallback(hybrid_query)
    if RAG_PIPELINE.is_ready():
        logger.info(f"RAG pipeline initialized. FAISS index contains {RAG_PIPELINE.retriever.faiss_manager.index_size()} vectors.")
    else:
        logger.warning("RAG pipeline initialized but FAISS index not found. Run build_index.py to create it.")
except Exception as e:
    logger.warning(f"RAG pipeline not available: {e}")

def extract_device_name(answer):
    match = re.search(r'Device:\s*([^|]+)', answer)
    if match:
        return match.group(1).strip()
    for brand in ['GE', 'Philips', 'Siemens', 'Canon', 'Fujifilm', 'Schiller', 'BPL', 'Mindray', 'Nihon', 'Dr\u00e4ger']:
        bm = re.search(rf'{brand}\s+[\w\s/]+?(?:\s+has|\s+provides|\s+is|\s+costs|\s+uses|\s+are|\s+offers|\s+supports|,|\||$)', answer)
        if bm:
            return bm.group(0).strip().rstrip(',').strip()
    return None

def categorize_question(query):
    q = query.lower()
    if any(w in q for w in ['price', 'cost', 'cheap', 'expensive', '\u20b9', 'lakh', 'crore']):
        return 'Pricing'
    if any(w in q for w in ['accuracy', 'accurate']):
        return 'Performance'
    if any(w in q for w in ['manufacturer', 'manufactures', 'manufactured', 'who makes']):
        return 'Manufacturer'
    if any(w in q for w in ['feature', 'features']):
        return 'Features'
    if any(w in q for w in ['application', 'applications', 'used for', 'imaging']):
        return 'Applications'
    if any(w in q for w in ['best', 'highest', 'lowest', 'cheapest', 'most expensive', 'recommend']):
        return 'Comparison'
    if any(w in q for w in ['tell me about', 'what is', 'describe', 'who']):
        return 'General Information'
    return 'General Information'

# --- AUTH MIDDLEWARE ---
def verify_supabase_token(token):
    if not token:
        return None
    if supabase is not None:
        try:
            user_resp = supabase.auth.get_user(jwt=token)
            if user_resp and user_resp.user:
                return {"id": user_resp.user.id, "email": getattr(user_resp.user, "email", None), "token": token}
        except Exception:
            pass
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            return {"id": payload.get("sub"), "email": payload.get("email"), "token": token}
        except JWTError:
            pass
    return None

def set_supabase_auth(user):
    if supabase is not None and user and user.get("token"):
        supabase.postgrest.auth(token=user["token"])
        logger.debug(f"PostgREST auth set for user {user.get('id', 'unknown')[:8]}")

def require_auth_or_guest(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", None)
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
        if not token:
            token = request.cookies.get("sb-access-token")
        request.user = verify_supabase_token(token)
        return f(*args, **kwargs)
    return decorated

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("sb-access-token")
        user = verify_supabase_token(token)
        if not user:
            return redirect(url_for("login_view"))
        request.user = user
        return f(*args, **kwargs)
    return decorated

def validate_chat_payload(payload):
    if not payload:
        return False, "Missing data matrix footprint."
    message = payload.get("message", "")
    if not isinstance(message, str):
        return False, "Data packet sequence structure violation: expected plain string."
    if len(message.strip()) > 4000:
        return False, "Query content array length exceeds maximum safety allocation bounds."
    return True, None

# --- PUBLIC PAGE ROUTES ---
@app.route("/")
def index():
    return render_template("home.html")

@app.route("/about")
def about_view():
    return render_template("about.html")

@app.route("/devices")
def devices_view():
    return render_template("devices.html")

@app.route("/contact")
def contact_view():
    return render_template("contact.html")

@app.route("/dashboard")
def dashboard_view():
    return render_template("index.html")

@app.route("/profile")
def profile_view():
    token = request.cookies.get("sb-access-token")
    user = verify_supabase_token(token)
    if not user:
        return redirect(url_for("login_view"))
    request.user = user
    return render_template("profile.html")

@app.route("/user")
@require_auth
def user_dashboard_view():
    return render_template("user_home.html")

@app.route("/login")
def login_view():
    token = request.cookies.get("sb-access-token")
    user = verify_supabase_token(token)
    if user:
        return redirect(url_for("dashboard_view"))
    return render_template("login.html")

# --- CONTACT API ---
@app.route("/api/contact", methods=["POST"])
@require_auth_or_guest
def handle_contact():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    email = payload.get("email", "").strip()
    subject = payload.get("subject", "").strip()
    message = payload.get("message", "").strip()
    if not all([name, email, subject, message]):
        return jsonify({"status": "error", "message": "All fields are required."}), 400
    logger.info(f"Contact form submission from {name} <{email}>: {subject}")
    return jsonify({
        "status": "success",
        "message": f"Thank you, {name}! Your message has been received. We will respond within 24 hours."
    })

# --- DEVICES DATA API ---
@app.route("/api/devices", methods=["GET"])
def get_devices():
    devices = []
    seen_names = set()
    for i in range(len(QA_QUESTIONS)):
        q = QA_QUESTIONS[i]
        a = QA_ANSWERS[i]
        name = extract_device_name(a) or extract_device_name(q) or ""
        if not name and q.lower().startswith("tell me about"):
            name = q.replace("Tell me about", "", 1).strip()
        if not name:
            continue
        if name in seen_names:
            continue
        seen_names.add(name)
        desc = a[:200]
        device = {
            "name": name,
            "description": desc,
            "manufacturer": extract_device_name(a) or "Various",
            "category": "General"
        }
        name_lower = name.lower()
        desc_lower = desc.lower()
        if any(w in desc_lower or w in name_lower for w in ['x-ray', 'definium', 'multix', 'digitaldiagnost', 'fdr smart']):
            device["category"] = "X-Ray"
        elif any(w in desc_lower or w in name_lower for w in ['ct', 'somatom', 'revolution', 'incisive', 'aquilion', 'scenaria']):
            device["category"] = "CT Scanner"
        elif any(w in desc_lower or w in name_lower for w in ['mri', 'magnetom', 'ingenia', 'signa', 'vantage', 'echelon']):
            device["category"] = "MRI"
        elif any(w in desc_lower or w in name_lower for w in ['ultrasound', 'epiq', 'voluson', 'sequoia', 'aplio', 'arietta']):
            device["category"] = "Ultrasound"
        elif any(w in desc_lower or w in name_lower for w in ['ecg', 'pagewriter', 'cardiovit', 'cardiart', 'mac 2000', 'beneheart']):
            device["category"] = "ECG"
        elif any(w in desc_lower or w in name_lower for w in ['patient monitor', 'intellivue', 'carescape', 'benevision', 'life scope', 'vista', 'monitor']):
            device["category"] = "Patient Monitor"
        elif any(w in desc_lower or w in name_lower for w in ['ventilator', 'respiratory']):
            device["category"] = "Ventilator"
        elif any(w in desc_lower or w in name_lower for w in ['defibrillator', 'aed']):
            device["category"] = "Defibrillator"
        elif any(w in desc_lower or w in name_lower for w in ['infusion pump', 'syringe pump']):
            device["category"] = "Infusion Device"
        elif any(w in desc_lower or w in name_lower for w in ['ultrasound', 'transducer', 'probe']):
            device["category"] = "Ultrasound"
        devices.append(device)
    return jsonify({"status": "success", "devices": devices, "total": len(devices)})

# --- CONTACT API ---
@app.route("/api/chat", methods=["POST"])
@require_auth_or_guest
def handle_chat():
    payload = request.get_json(silent=True) or {}
    is_valid, error_msg = validate_chat_payload(payload)
    if not is_valid:
        return jsonify({"status": "error", "message": error_msg}), 400
    user_query = payload.get("message", "").strip()
    start_time = time.time()
    category = categorize_question(user_query)

    # Reject non-medical-device questions
    if not is_medical_device_query(user_query):
        return jsonify({
            "status": "success",
            "answer": ("I'm designed to answer questions about medical devices only. "
                       "Please ask me about medical equipment, diagnostics, imaging, "
                       "patient monitoring, or healthcare devices."),
            "device": None, "confidence": 0.0, "category": category,
            "response_time": round((time.time() - start_time) * 1000, 2),
            "authenticated": request.user is not None, "history_retained": False,
            "retrieved_from": None, "similarity_score": 0.0, "confidence_pct": 0.0
        })

    answer = None
    device = None
    confidence = 0.0
    retrieved_from = "Unknown"
    similarity_score = 0.0
    confidence_pct = 0.0

    # Primary: RAG pipeline (if available)
    if RAG_PIPELINE is not None:
        try:
            rag_answer, rag_meta = RAG_PIPELINE.answer(user_query)
            if rag_answer is not None and rag_meta is not None:
                answer = rag_answer
                device = rag_meta.get("device_name", "") or ""
                if not device or device == "Unknown":
                    device = extract_device_name(rag_answer) or ""
                confidence = rag_meta.get("similarity_score", 0.0)
                retrieved_from = rag_meta.get("retrieved_from", "Unknown")
                similarity_score = rag_meta.get("similarity_score", 0.0)
                confidence_pct = rag_meta.get("confidence_pct", 0.0)
        except Exception as e:
            logger.error(f"RAG pipeline error: {e}")

    # Fallback: direct TF-IDF question matching against dataset
    if not answer:
        result_text, fallback_conf, fallback_source = hybrid_query(user_query)
        if result_text and fallback_conf >= SIMILARITY_THRESHOLD:
            answer = result_text
            device = extract_device_name(answer)
            confidence = fallback_conf
            retrieved_from = "Device Dataset"
            similarity_score = round(fallback_conf, 4)
            confidence_pct = round(fallback_conf * 100, 2)

    # Polite decline if no match found
    if not answer:
        answer = ("Sorry, I couldn't find information about this medical device in my knowledge base.")
        device = None
        confidence = 0.0

    response_time_ms = round((time.time() - start_time) * 1000, 2)
    is_persistent = False
    if request.user and supabase is not None:
        try:
            set_supabase_auth(request.user)
            chat_record = {
                "user_id": request.user["id"],
                "session_id": payload.get("session_id", "v2_dynamic_session"),
                "prompt": user_query,
                "response": answer
            }
            supabase.table("chat_history").insert(chat_record).execute()
            is_persistent = True
        except:
            pass
    return jsonify({
        "status": "success", "answer": answer, "device": device,
        "confidence": round(confidence, 4), "category": category,
        "response_time": response_time_ms, "authenticated": request.user is not None,
        "history_retained": is_persistent,
        "retrieved_from": retrieved_from,
        "similarity_score": similarity_score,
        "confidence_pct": confidence_pct
    })

@app.route("/api/suggestions", methods=["GET"])
def get_suggestions():
    if QA_QUESTIONS and len(QA_QUESTIONS) >= 3:
        suggestions = random.sample(QA_QUESTIONS, min(3, len(QA_QUESTIONS)))
    else:
        suggestions = [
            "Tell me about Siemens Multix Fusion",
            "What is the price of GE Definium Tempo?",
            "Which MRI machine has highest accuracy?"
        ]
    return jsonify({"status": "success", "suggestions": suggestions})

@app.route("/api/dispatch", methods=["POST"])
@require_auth_or_guest
def dispatch_order():
    payload = request.get_json(silent=True) or {}
    device_id = payload.get("device_id", "").strip()
    priority = payload.get("priority", "routine")
    if not device_id:
        return jsonify({"status": "error", "message": "Device Tag ID is required"}), 400
    order_id = f"DSP-{uuid.uuid4().hex[:8].upper()}"
    return jsonify({
        "status": "success",
        "message": f"Order {order_id} dispatched successfully with {priority} priority. Estimated delivery: 5-7 business days.",
        "order_id": order_id
    })

@app.route("/api/order-device", methods=["POST"])
@require_auth_or_guest
def order_device():
    if not request.user:
        return jsonify({"status": "error", "message": "Please sign in to place an order."}), 401

    payload = request.get_json(silent=True) or {}
    required = ['device_name', 'hospital_name', 'doctor_name', 'phone']
    for field in required:
        if not payload.get(field, "").strip():
            return jsonify({"status": "error", "message": f"{field.replace('_', ' ').title()} is required"}), 400

    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow().isoformat()

    user_email = request.user.get("email", "")
    user_name = user_email.split("@")[0] if "@" in user_email else user_email

    order_record = {
        "order_id": order_id,
        "user_id": request.user["id"],
        "user_name": user_name,
        "user_email": user_email,
        "device_name": payload.get("device_name", "").strip(),
        "device_category": payload.get("category", "").strip(),
        "device_model": payload.get("model", "").strip(),
        "manufacturer": payload.get("manufacturer", "").strip(),
        "quantity": int(payload.get("quantity", 1)),
        "priority": payload.get("priority", "normal"),
        "purpose": payload.get("purpose", "").strip(),
        "hospital_name": payload.get("hospital_name", "").strip(),
        "department": payload.get("department", "").strip(),
        "ward_icu": payload.get("ward", "").strip(),
        "doctor_name": payload.get("doctor_name", "").strip(),
        "contact_person": payload.get("contact_person", "").strip(),
        "contact_number": payload.get("phone", "").strip(),
        "patient_name": payload.get("patient_name", "").strip(),
        "patient_id": payload.get("patient_id", "").strip(),
        "patient_age": str(payload.get("patient_age", "")),
        "patient_gender": payload.get("patient_gender", ""),
        "medical_condition": payload.get("diagnosis", "").strip(),
        "delivery_address": payload.get("address", "").strip(),
        "city": payload.get("city", "").strip(),
        "state": payload.get("state", "").strip(),
        "postal_code": payload.get("zip", "").strip(),
        "country": payload.get("country", "United States").strip(),
        "additional_notes": payload.get("notes", "").strip(),
        "order_status": "Pending",
        "created_date": now,
        "last_updated_date": now
    }

    logger.info(f"Order request payload received: order_id={order_id}, user={request.user.get('id','')[:8]}, device={order_record['device_name']}")

    db_success = False
    db_error = None
    if supabase is not None:
        try:
            set_supabase_auth(request.user)
            logger.info(f"Inserting order into Supabase: {order_id}")
            supabase.table("device_orders").insert(order_record).execute()
            db_success = True
            logger.info(f"Order {order_id} stored in Supabase for user {request.user['id']}")
        except Exception as db_err:
            db_error = str(db_err)
            logger.error(f"Supabase insert failed for order {order_id}: {db_error}")
    else:
        db_error = "Supabase client not initialized"
        logger.error(f"Cannot store order {order_id}: Supabase client not initialized")

    if not db_success:
        return jsonify({
            "status": "error",
            "message": f"Order could not be stored in the database: {db_error or 'unknown error'}",
            "order_id": order_id
        }), 500

    return jsonify({
        "status": "success",
        "message": f"Order {order_id} confirmed for {order_record['quantity']} x {order_record['device_name']}. Our sales team will contact you within 24 hours.",
        "order_id": order_id,
        "db_stored": True
    })

@app.route("/api/orders", methods=["GET"])
@require_auth_or_guest
def get_user_orders():
    if not request.user:
        return jsonify({"status": "error", "message": "Authentication required"}), 401

    orders = []
    if supabase is not None:
        try:
            set_supabase_auth(request.user)
            response = supabase.table("device_orders") \
                .select("*") \
                .eq("user_id", request.user["id"]) \
                .order("created_date", desc=True) \
                .execute()
            orders = response.data or []
        except Exception as db_err:
            logger.error(f"Failed to fetch orders from Supabase: {str(db_err)}")

    return jsonify({
        "status": "success",
        "orders": orders,
        "total": len(orders)
    })

@app.route("/api/user/data", methods=["GET"])
@require_auth_or_guest
def user_data():
    if not request.user:
        return jsonify({"status": "error", "message": "Authentication required"}), 401
    return jsonify({
        "status": "success",
        "user": request.user,
        "authenticated": True
    })

@app.route("/api/auth/session", methods=["GET"])
@require_auth_or_guest
def auth_session():
    if request.user:
        return jsonify({"authenticated": True, "user": request.user})
    return jsonify({"authenticated": False, "user": None})

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    response = jsonify({"status": "success"})
    response.delete_cookie("sb-access-token")
    response.delete_cookie("sb-user-email")
    return response

# --- MEDICAL REPORT ANALYZER ---
from medical_report_analyzer import (
    allowed_file, extract_text, clean_text, extract_medical_keywords,
    extract_medical_values, recommend_devices, assess_risk, generate_summary,
    generate_recommendations, generate_possible_conditions, analyze_report,
    generate_pdf_report, UPLOAD_DIR, MAX_FILE_SIZE
)

@app.route("/api/report/upload", methods=["POST"])
@require_auth_or_guest
def upload_report():
    if not request.user:
        return jsonify({"status": "error", "message": "Please sign in to upload medical reports."}), 401

    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file provided. Please select a medical report to upload."}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"status": "error", "message": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"status": "error", "message": "Unsupported file format. Please upload JPG, JPEG, PNG, or PDF files only."}), 400

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    if file_size > MAX_FILE_SIZE:
        return jsonify({"status": "error", "message": f"File size exceeds the maximum limit of {MAX_FILE_SIZE // (1024*1024)} MB."}), 400

    report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
    ext = file.filename.rsplit('.', 1)[1].lower()
    safe_filename = f"{report_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    file.save(file_path)

    logger.info(f"Report uploaded: {file.filename} -> {safe_filename} for user {request.user['id'][:8]}")

    try:
        result = analyze_report(file_path, file.filename, ext, _build_devices_df())
    except Exception as e:
        logger.error(f"Report analysis failed: {e}")
        try:
            os.remove(file_path)
        except Exception:
            pass
        return jsonify({"status": "error", "message": f"Analysis failed: {str(e)}"}), 500

    if result.get("status") == "error":
        try:
            os.remove(file_path)
        except Exception:
            pass
        return jsonify(result), 422

    if supabase is not None:
        try:
            set_supabase_auth(request.user)
            analysis = result.get("analysis", {})
            db_record = {
                "report_id": report_id,
                "user_id": request.user["id"],
                "file_name": file.filename,
                "file_type": ext,
                "file_size": file_size,
                "extracted_text": result.get("extracted_text", ""),
                "analysis_summary": analysis.get("summary", ""),
                "possible_conditions": json.dumps(analysis.get("possible_conditions", [])),
                "medical_values": json.dumps(analysis.get("medical_values", [])),
                "symptoms": json.dumps(analysis.get("symptoms", [])),
                "recommended_devices": json.dumps(analysis.get("recommended_devices", [])),
                "risk_category": analysis.get("risk_level", "Unknown"),
                "recommendations": json.dumps(analysis.get("recommendations", [])),
                "raw_response": json.dumps(result)
            }
            supabase.table("medical_reports").insert(db_record).execute()
            logger.info(f"Report analysis saved to Supabase: {report_id}")
        except Exception as db_err:
            logger.error(f"Failed to save report analysis to Supabase: {db_err}")

    clean_result = {
        "status": "success",
        "report_id": report_id,
        "file_name": file.filename,
        "word_count": result.get("word_count", 0),
        "analysis": result.get("analysis", {}),
        "disclaimer": result.get("disclaimer", ""),
        "report_id_display": report_id
    }

    return jsonify(clean_result)

@app.route("/api/report/history", methods=["GET"])
@require_auth_or_guest
def get_report_history():
    if not request.user:
        return jsonify({"status": "error", "message": "Authentication required"}), 401

    reports = []
    if supabase is not None:
        try:
            set_supabase_auth(request.user)
            response = supabase.table("medical_reports") \
                .select("*") \
                .eq("user_id", request.user["id"]) \
                .order("uploaded_at", desc=True) \
                .execute()
            reports = response.data or []
        except Exception as db_err:
            logger.error(f"Failed to fetch report history: {db_err}")

    for r in reports:
        if isinstance(r.get("possible_conditions"), str):
            try: r["possible_conditions"] = json.loads(r["possible_conditions"])
            except: pass
        if isinstance(r.get("medical_values"), str):
            try: r["medical_values"] = json.loads(r["medical_values"])
            except: pass
        if isinstance(r.get("symptoms"), str):
            try: r["symptoms"] = json.loads(r["symptoms"])
            except: pass
        if isinstance(r.get("recommended_devices"), str):
            try: r["recommended_devices"] = json.loads(r["recommended_devices"])
            except: pass
        if isinstance(r.get("recommendations"), str):
            try: r["recommendations"] = json.loads(r["recommendations"])
            except: pass

    return jsonify({
        "status": "success",
        "reports": reports,
        "total": len(reports)
    })

@app.route("/api/report/download/<report_id>", methods=["GET"])
@require_auth_or_guest
def download_report_pdf(report_id):
    if not request.user:
        return jsonify({"status": "error", "message": "Authentication required"}), 401

    if supabase is not None:
        try:
            set_supabase_auth(request.user)
            response = supabase.table("medical_reports") \
                .select("*") \
                .eq("report_id", report_id) \
                .eq("user_id", request.user["id"]) \
                .execute()
            records = response.data or []
            if not records:
                return jsonify({"status": "error", "message": "Report not found."}), 404
            raw_response = records[0].get("raw_response", "{}")
            if isinstance(raw_response, str):
                analysis_data = json.loads(raw_response)
            else:
                analysis_data = raw_response
        except Exception as db_err:
            return jsonify({"status": "error", "message": f"Failed to fetch report: {db_err}"}), 500
    else:
        return jsonify({"status": "error", "message": "Database not available."}), 500

    pdf_buffer = generate_pdf_report(analysis_data)
    if pdf_buffer is None:
        return jsonify({"status": "error", "message": "PDF generation failed."}), 500

    return Response(
        pdf_buffer.getvalue(),
        mimetype='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{report_id}_analysis.pdf"'}
    )

@app.errorhandler(404)
def handle_resource_not_found(error):
    logger.warning(f"Resource request mapping gap occurred at path: {request.path}")
    return render_template("landing.html", error_msg="The requested system terminal mapping path does not exist."), 404

@app.errorhandler(500)
def handle_internal_server_error(error):
    logger.critical(f"Unhandled critical pipeline exception caught: {str(error)}")
    return jsonify({
        "status": "error", "code": 500,
        "message": "Internal processing engine error."
    }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
