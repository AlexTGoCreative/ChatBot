from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import os
import google.generativeai as genai
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from fastapi.middleware.cors import CORSMiddleware

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or "AIzaSyDmsf6rzcUXcFLt2JG1YyAGSR0Ixbdi7oY"
genai.configure(api_key=GOOGLE_API_KEY)

DB_DIR = "chroma_db"
DOC_PATH = "scraped_html/hash_lookup.txt"
loader = TextLoader(DOC_PATH, encoding="utf-8")
documents = loader.load()
splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=300)
chunks = splitter.split_documents(documents)
embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vectordb = Chroma.from_documents(chunks, embedding=embedding_model, persist_directory=DB_DIR)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_scan_context = {"content": ""}

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatPayload(BaseModel):
    chat_history: List[ChatMessage]
    scan_results: Optional[dict] = None

@app.post("/ask")
def ask(payload: ChatPayload):
    global latest_scan_context

    if payload.scan_results:
        scan_summary = "\n".join([f"{k}: {v}" for k, v in payload.scan_results.items()])
        latest_scan_context["content"] = f"Scan results:\n{scan_summary}"

    last_question = next((msg.text for msg in reversed(payload.chat_history) if msg.role == "user"), None)
    if not last_question:
        return {"answer": "No question found in chat history."}

    retriever = vectordb.as_retriever()
    relevant_docs = retriever.invoke(last_question)
    model = genai.GenerativeModel("models/gemini-2.0-flash")

    doc_context = "\n\n".join([doc.page_content for doc in relevant_docs])
    combined_context = f"{latest_scan_context['content']}\n\n{doc_context}"

    prompt = f"""
You are a helpful assistant for cybersecurity documentation.
Use the CONTEXT below to answer the user's question.
Only use the information provided. If you don't know the answer, say so.

--- CONTEXT START ---
{combined_context}
--- CONTEXT END ---

QUESTION: {last_question}

Answer clearly using technical language if needed.
"""

    response = model.generate_content(prompt)
    return {"answer": response.text}
