
# 🤖 Gemini ChatBot with OPSWAT Documentation (RAG-Powered)

A full-stack chatbot built with **Vite + React (JavaScript)** and a **Python (FastAPI)** backend and **Node.js** backend.  
The chatbot uses **Gemini 1.5 API** and a **Retrieval-Augmented Generation (RAG)** pipeline to answer technical questions based on **OPSWAT documentation**.

---

## 🚀 Features

- 🔍 **RAG Pipeline**: Combines vector search with LLM generation for accurate, context-aware answers.
- 📄 **Web Scraping**: Dynamically fetches OPSWAT documentation.
- 💬 **Chat Interface**: Clean and responsive UI powered by React and Vite.
- ⚡ **FastAPI Python Backend**: Handles certain parts of the application, such as scraping and embedding vector search.
- ⚡ **Node.js Backend**: Manages requests and interactions with the Gemini API, as well as hash-based scan data context.
- 🔑 **Gemini 1.5 Integration**: Uses Google's LLM to interpret queries and generate responses.
- 🧠 **Direct File Scan (Drag and Drop)**: Users can now upload files directly via drag-and-drop or input a URL for scanning.
- 🌐 **URL Scan**: A text box allows users to enter a URL that will be scanned for relevant content.

---

## 🧠 What is RAG?

**Retrieval-Augmented Generation (RAG)** is a technique where:
1. Relevant documents are **retrieved** from a vector database based on a query.
2. These documents are **augmented** as context and passed to an LLM.
3. The LLM **generates** a grounded and relevant response.

In this project, the OPSWAT docs are vectorized and used to provide context to Gemini.

Additionally, users can **upload a file via drag and drop** or **enter a URL** to retrieve and scan its content for more context in the chatbot's responses.

---

## 📦 Tech Stack

| Component       | Stack                    |
|----------------|--------------------------|
| Frontend       | Vite + React (JavaScript)|
| Backend (Python)| FastAPI (Python 3.10)     |
| Backend (Node.js)| Node.js (with Express) and Python(FASTAPI) |
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

### 3. Backend Setup (Python - FastAPI)

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

### 5. Start Backend (FastAPI Python)

```bash
uvicorn chat_api:app --reload 
```

This starts the Python backend

---

### 6. Backend Setup (Node.js)

```bash
npm install
```

Then start the Node.js backend with:

```bash
npm start
```

This will start the Node.js backend, which handles the Gemini API interactions and scan data lookups.

---

### 7. Start Frontend

```bash
npm run dev
```

Now you can open the chatbot in your browser and start asking technical questions!

---

## 🧑‍💻 New Scan Features

Users can now scan files or URLs in the chatbot:

### **Drag-and-Drop File Upload**  
There is now a drag-and-drop area in the chat interface where users can upload files directly for scanning.

### **URL Scan**  
A text box allows users to input a URL to be scanned for relevant information.

Once a file is uploaded or a URL is provided, the chatbot will process the content and generate accurate, context-aware responses.

---

## 🔐 Environment Variables

In **ChatBot-API/chat_api.py** (Node.js backend):

```python
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or "API_KEY"
genai.configure(api_key=GOOGLE_API_KEY)
```

---
