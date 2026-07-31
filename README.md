<div align="center">

# 🏥 MedDevice.AI

### AI-Powered Medical Device Assistant

An intelligent healthcare platform that helps users discover, understand, and recommend medical devices using **Artificial Intelligence, Machine Learning, Retrieval-Augmented Generation (RAG), Optical Character Recognition (OCR), and Speech Recognition**.

<p align="center">
<a href=["MedDevice.AI"](https://meddevice-ai.onrender.com/)>
<img src="https://img.shields.io/badge/🌐_Live_Demo-Visit_Website-4F46E5?style=for-the-badge">
</a>

</p>

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Backend-Flask-black?logo=flask)
![Machine Learning](https://img.shields.io/badge/Machine-Learning-orange)
![RAG](https://img.shields.io/badge/RAG-FAISS-purple)
![OCR](https://img.shields.io/badge/OCR-Tesseract-green)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)
![Bootstrap](https://img.shields.io/badge/UI-Bootstrap-7952B3?logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

# 📖 Overview

**MedDevice.AI** is an AI-powered healthcare web application developed to simplify medical device discovery and recommendation.

The platform enables users to interact with an intelligent chatbot using natural language, upload medical reports for automated analysis, receive personalized medical device recommendations, and securely manage device orders through a cloud-based platform.

The project integrates multiple AI technologies including:

- Machine Learning
- Retrieval-Augmented Generation (RAG)
- FAISS
- Optical Character Recognition (OCR)
- Speech Recognition
- Supabase Authentication

to provide an intelligent and user-friendly healthcare assistance platform.

---

# ✨ Features

- 🤖 AI Medical Device Chatbot
- 🔍 Retrieval-Augmented Generation (RAG)
- 📚 FAISS Knowledge Retrieval
- 🧠 Machine Learning Intent Classification
- 📄 OCR-based Medical Report Analyzer
- 🎤 Speech Recognition
- 🩺 Medical Device Recommendation
- 📋 Medical Device Information
- 🔐 Secure Login & Signup
- 👤 Personalized Dashboard
- 💬 Chat History
- 🛒 Medical Device Ordering
- ☁️ Cloud Database Integration
- 📱 Responsive UI

---

# 🚀 Live Demo

### 🌐 Website

👉 [**MedDevice.AI**](https://meddevice-ai.onrender.com/)

---

# 🛠️ Tech Stack

## Programming Languages

- Python
- HTML5
- CSS3
- JavaScript

---

## Frontend

- Bootstrap 5
- Responsive UI
- Fetch API

---

## Backend

- Flask
- REST APIs

---

## Machine Learning

- Scikit-learn
- TF-IDF Vectorizer
- Logistic Regression

---

## AI Technologies

- Retrieval-Augmented Generation (RAG)
- FAISS
- NLP
- Speech Recognition

---

## OCR

- Tesseract OCR
- pytesseract
- pdf2image

---

## Database & Authentication

- Supabase
- PostgreSQL

---

## Development Tools

- VS Code
- Git
- GitHub

---

# 🏗️ System Architecture

```
                User
                  │
                  ▼
        Responsive Web Application
     (HTML • CSS • Bootstrap • JS)
                  │
                  ▼
             Flask Backend
                  │
    ┌─────────────┼──────────────┐
    │             │              │
    ▼             ▼              ▼
Machine       OCR Engine     Authentication
Learning      Tesseract        Supabase
(TF-IDF +
Logistic Regression)
    │
    ▼
FAISS + RAG
    │
    ▼
Knowledge Base
    │
    ▼
Medical Device Recommendation
    │
    ▼
Chat History & Device Orders
```

---

# 🔄 Workflow

1. User logs into the platform.
2. User enters a text query or uses voice input.
3. Query is preprocessed using NLP.
4. TF-IDF converts text into numerical vectors.
5. Logistic Regression predicts user intent.
6. FAISS retrieves relevant medical device knowledge.
7. RAG generates a context-aware response.
8. Users may upload medical reports.
9. OCR extracts medical information.
10. Medical devices are recommended based on extracted findings.
11. Users can place orders.
12. Chat history and orders are securely stored in Supabase.

---

# 📂 Project Structure

```
MedDevice.AI
│
├── app.py
├── build_index.py
├── train_model.py
├── requirements.txt
│
├── dataset
│   ├── medical_devices.csv
│   └── ...
│
├── models
│   ├── logistic_model.pkl
│   ├── tfidf_vectorizer.pkl
│   └── faiss_index
│
├── templates
│   ├── index.html
│   ├── dashboard.html
│   ├── login.html
│   ├── report_analyzer.html
│   └── ...
│
├── static
│   ├── css
│   ├── js
│   ├── images
│   └── uploads
│
├── utils
│
└── README.md
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone YOUR_GITHUB_REPO_URL
```

```bash
cd MedDevice.AI
```

---

## Create Virtual Environment

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Build FAISS Index

```bash
python build_index.py
```

---

## Start Application

```bash
python app.py
```

Open

```
http://127.0.0.1:5000
```

---

# 📊 Functional Modules

- User Authentication
- AI Chatbot
- TF-IDF Vectorization
- Logistic Regression
- Retrieval-Augmented Generation
- FAISS Retrieval
- OCR Report Analyzer
- Medical Device Recommendation
- Speech Recognition
- Personalized Dashboard
- Chat History
- Medical Device Ordering
- Cloud Database Management

---

# 🎯 Future Enhancements

- 🤖 Large Language Model (LLM) Integration
- 🌍 Multilingual Support
- 📱 Android & iOS Application
- 🏥 Hospital Database Integration
- 🖼️ Image-based Medical Device Recognition
- 📦 Real-time Inventory Management
- 📈 Advanced Analytics Dashboard
- ☁️ Cloud Deployment Optimization

---

# 💻 Technologies Used

| Category | Technologies |
|----------|--------------|
| Programming | Python, HTML, CSS, JavaScript |
| Backend | Flask |
| Frontend | Bootstrap |
| ML | Scikit-learn, TF-IDF, Logistic Regression |
| AI | RAG, FAISS |
| OCR | Tesseract OCR, pytesseract, pdf2image |
| Database | Supabase PostgreSQL |
| Voice | Web Speech API |

---

# 👨‍💻 Author

## **Suyash Hadole**

Founder & Developer — **MedDevice.AI**

🎓 B.Tech Computer Science & Engineering (AI & ML)

MIT Academy of Engineering, Pune

📧 Email:
**suyashhadole14@mail.com**

🌐 LinkedIn

https://www.linkedin.com/in/suyash-hadole/
  

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch

```
git checkout -b feature-name
```

3. Commit your changes

```
git commit -m "Added new feature"
```

4. Push

```
git push origin feature-name
```

5. Open a Pull Request

---

# ⭐ Support

If you found this project useful,

⭐ Star this repository

🍴 Fork the project

📢 Share it with others


<div align="center">

### ❤️ Built with Python, Flask, Machine Learning, RAG & OCR

**MedDevice.AI — Empowering Healthcare Through Artificial Intelligence**

</div>
