# MedDevice.AI – AI-Powered Medical Device Assistant

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-Web%20Framework-black?logo=flask)
![Machine Learning](https://img.shields.io/badge/Machine%20Learning-Scikit--Learn-orange)
![RAG](https://img.shields.io/badge/RAG-FAISS-purple)
![OCR](https://img.shields.io/badge/OCR-Tesseract-green)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-blue)

**An AI-powered web application that helps users discover, understand, and recommend medical devices using Machine Learning, Retrieval-Augmented Generation (RAG), Optical Character Recognition (OCR), and Speech Recognition.**

</div>

---

## 📖 Overview

**MedDevice.AI** is an intelligent healthcare web application developed to simplify medical device information retrieval. Users can interact with an AI chatbot using natural language, upload medical reports for OCR-based analysis, receive personalized medical device recommendations, and manage device orders through a secure cloud-based platform.

The project combines **Machine Learning**, **Retrieval-Augmented Generation (RAG)**, **FAISS**, **Optical Character Recognition (OCR)**, **Speech Recognition**, and **Supabase** into a unified healthcare assistance system.

---

# ✨ Key Features

* 🤖 AI-powered Medical Device Chatbot
* 🔍 Retrieval-Augmented Generation (RAG)
* 📄 OCR-based Medical Report Analysis
* 🎤 Speech Recognition
* 🏥 Medical Device Recommendation
* 📚 Medical Device Knowledge Base
* 🔐 Secure User Authentication
* 📊 Personalized Dashboard
* 💬 Chat History
* 🛒 Medical Device Ordering
* 📱 Fully Responsive UI

---

# 🛠️ Tech Stack

### Programming Languages

* Python
* HTML5
* CSS3
* JavaScript

### Frontend

* Bootstrap 5
* Responsive UI

### Backend

* Flask
* REST APIs

### Machine Learning

* Scikit-learn
* TF-IDF Vectorization
* Logistic Regression

### AI Technologies

* Retrieval-Augmented Generation (RAG)
* FAISS
* NLP
* Speech Recognition

### OCR

* Tesseract OCR
* pytesseract
* pdf2image

### Database & Authentication

* Supabase
* PostgreSQL

### Development Tools

* VS Code
* Git
* GitHub

---

# 🏗️ System Architecture

```
                    User
                      │
                      ▼
          Responsive Web Interface
        (HTML • CSS • Bootstrap • JS)
                      │
                      ▼
              Flask Backend API
                      │
      ┌───────────────┼────────────────┐
      │               │                │
      ▼               ▼                ▼
Machine Learning     OCR Engine     Authentication
(TF-IDF + LR)      (Tesseract)      (Supabase)
      │               │
      ▼               ▼
 FAISS + RAG     Report Analysis
      │               │
      └───────► Device Recommendation
                      │
                      ▼
              Supabase Database
                      │
                      ▼
          Chat History & Device Orders
```

---

# 🚀 Features Workflow

1. User logs into the application.
2. User enters a text query or uses voice input.
3. Query is preprocessed using NLP techniques.
4. TF-IDF converts text into feature vectors.
5. Logistic Regression predicts user intent.
6. RAG retrieves relevant knowledge using FAISS.
7. AI chatbot generates a context-aware response.
8. Users can upload medical reports.
9. OCR extracts medical information.
10. System recommends appropriate medical devices.
11. Users can place device orders.
12. Chat history and orders are stored securely in Supabase.

---

# 📂 Project Structure

```
MedDevice.AI/
│
├── app.py
├── build_index.py
├── train_model.py
├── requirements.txt
├── README.md
│
├── dataset/
│   ├── medical_devices.csv
│   └── ...
│
├── models/
│   ├── logistic_model.pkl
│   ├── tfidf_vectorizer.pkl
│   └── faiss_index
│
├── static/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── uploads/
│
├── templates/
│   ├── index.html
│   ├── dashboard.html
│   ├── login.html
│   └── ...
│
├── utils/
│
└── reports/
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/MedDevice.AI.git

cd MedDevice.AI
```

---

## Create Virtual Environment

```bash
python -m venv venv
```

Activate

Windows

```bash
venv\Scripts\activate
```

Linux / macOS

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

## Run Application

```bash
python app.py
```

Open

```
http://127.0.0.1:5000
```

---

# 📸 Screenshots

Add screenshots here.

```
Home Page

AI Chatbot

Medical Report Analyzer

Dashboard

Medical Device Ordering
```

---

# 📊 Core Modules

* AI Chatbot
* Machine Learning Prediction
* TF-IDF Vectorization
* Logistic Regression
* Retrieval-Augmented Generation
* FAISS Similarity Search
* OCR Report Analyzer
* Speech Recognition
* Supabase Authentication
* Chat History
* Medical Device Ordering

---

# 🎯 Future Enhancements

* Large Language Model (LLM) Integration
* Multilingual Support
* Mobile Application
* Hospital Database Integration
* Image-based Medical Device Recognition
* Real-time Inventory Management
* Advanced Recommendation Engine

---

# 👨‍💻 Author

**Suyash Hadole**

**Founder & Developer – MedDevice.AI**

B.Tech Computer Science & Engineering (AI & ML)

MIT Academy of Engineering, Pune

📧 Email: **[suyashhadole14@mail.com](mailto:suyashhadole14@mail.com)**

🔗 LinkedIn: [https://www.linkedin.com/in/suyash-hadole/](https://www.linkedin.com/in/suyash-hadole/)

💻 GitHub: [https://github.com/yourusername](https://github.com/yourusername)

---

# 📜 License

This project is licensed under the **MIT License**.

---

# ⭐ Support

If you found this project helpful:

⭐ Star this repository

🍴 Fork the repository

🤝 Contribute by submitting Pull Requests

---

> **MedDevice.AI** demonstrates the practical application of Artificial Intelligence, Machine Learning, Retrieval-Augmented Generation (RAG), Optical Character Recognition (OCR), and cloud technologies to create an intelligent, scalable, and user-friendly healthcare assistance platform.
