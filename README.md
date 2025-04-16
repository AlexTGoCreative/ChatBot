
# 🤖 Gemini ChatBot with OPSWAT Documentation (RAG-Powered)

A full-stack chatbot built with **Vite + React (JavaScript)** and a **FastAPI (Python)** backend.  
The chatbot uses **Gemini 1.5 API** and a **Retrieval-Augmented Generation (RAG)** pipeline to answer technical questions based on **OPSWAT documentation**.

---

## 🚀 Features

- 🔍 **RAG Pipeline**: Combines vector search with LLM generation for accurate, context-aware answers.
- 📄 **Web Scraping**: Dynamically fetches OPSWAT documentation.
- 💬 **Chat Interface**: Clean and responsive UI powered by React and Vite.
- ⚡ **FastAPI Backend**: Handles vector search, Gemini API calls, and document indexing.
- 🔑 **Gemini 1.5 Integration**: Uses Google's LLM to interpret queries and generate responses.

---

## 🧠 What is RAG?

**Retrieval-Augmented Generation (RAG)** is a technique where:
1. Relevant documents are **retrieved** from a vector database based on a query.
2. These documents are **augmented** as context and passed to an LLM.
3. The LLM **generates** a grounded and relevant response.

In this project, the OPSWAT docs are vectorized and used to provide context to Gemini.

---

## 📦 Tech Stack

| Component       | Stack                    |
|----------------|--------------------------|
| Frontend       | Vite + React (JavaScript)|
| Backend        | FastAPI (Python 3.10)     |
| LLM API        | Gemini 1.5                |
| Vector Search  | FAISS (or similar)        |
| Embeddings     | Google / OpenAI           |
| Scraping       | Requests + BeautifulSoup  |

---

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/chatbot-gemini-opswat.git
cd chatbot-gemini-opswat
```

---

### 2. Frontend Setup

```bash
npm install
```

You can start the frontend later with:

```bash
npm run dev
```

---

### 3. Backend Setup (Python + FastAPI)

> Make sure you have **Python 3.10** installed.

```bash
py -3.10 -m venv venv
venv\Scripts\Activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

---

### 4. Scrape OPSWAT Documentation

Before starting the backend, scrape the documentation and build the vector store:

```bash
python scraping_hash_lookup.py
```

This script:
- Downloads content from OPSWAT docs.
- Processes and vectorizes the content.
- Saves the embeddings locally for use in RAG.

---

### 5. Start Backend Server

```bash
uvicorn chat_api:app --reload
```

---

### 6. Start Frontend

```bash
npm run dev
```

Now you can open the chatbot in your browser and start asking technical questions!

---

## 🔐 Environment Variables

In ChatBot-API\chat_api.py

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or "API_KEY"
genai.configure(api_key=GOOGLE_API_KEY)

---
