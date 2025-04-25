
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
- 🧠 **Hash-based Context**: Allows users to enter a **hash** to retrieve specific scan data, which is then used as context for generating more accurate answers.

---

## 🧠 What is RAG?

**Retrieval-Augmented Generation (RAG)** is a technique where:
1. Relevant documents are **retrieved** from a vector database based on a query.
2. These documents are **augmented** as context and passed to an LLM.
3. The LLM **generates** a grounded and relevant response.

In this project, the OPSWAT docs are vectorized and used to provide context to Gemini.

Additionally, users can provide a **hash** related to a scan, and the chatbot will use the scan results as part of the context for generating accurate responses.

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
git clone https://github.com/AlexTGoCreative/ChatBot
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
uvicorn main:app --reload --port 5000
```

This starts the backend on port 5000, allowing it to process hash-based scan data and provide relevant responses for the chatbot.

---

### 6. Start Frontend

```bash
npm run dev
```

Now you can open the chatbot in your browser and start asking technical questions!

---

## 🧑‍💻 Using Hash for Context

In addition to asking general technical questions, you can now **enter a hash** associated with a scan. This hash will retrieve relevant scan data (e.g., file name, scan status, scan date) and use it as additional context for the chatbot's responses.

### **Frontend - Entering Hash**  
There is now an input box in the chatbot interface where you can enter a **hash**. Once entered, the chatbot will fetch the scan data associated with that hash and provide more tailored responses.

### **Backend - Hash Lookup**  
When a hash is provided, the backend (FastAPI) will look up the scan results and pass them as context to the Gemini API to enhance the quality and relevance of the responses. The hash can be submitted via a simple **GET** request:

```bash
GET http://localhost:5000/api/scan/{hash}
```

This will return the associated scan data, which will be stored temporarily for generating the response.

### **Chat with Context**  
Once the hash is provided, every query to the chatbot will include that hash as part of the request. This allows the chatbot to provide more accurate and context-aware answers based on the scan results.

---

## 🔐 Environment Variables

In **ChatBot-API/chat_api.py**:

```python
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or "API_KEY"
genai.configure(api_key=GOOGLE_API_KEY)
```

---
