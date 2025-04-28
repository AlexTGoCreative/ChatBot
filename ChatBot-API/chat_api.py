from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import os
import json
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

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatPayload(BaseModel):
    chat_history: List[ChatMessage]
    scan_results: Optional[dict] = None

@app.post("/ask")
def ask(payload: ChatPayload):
    last_question = next((msg.text for msg in reversed(payload.chat_history) if msg.role == "user"), None)
    if not last_question:
        return {"answer": "No question found in chat history."}

    retriever = vectordb.as_retriever()
    relevant_docs = retriever.invoke(last_question)
    model = genai.GenerativeModel("models/gemini-2.0-flash")

    # Load latest scan result
    scan_context = ""
    try:
        latest_scan_files = sorted(
            [f for f in os.listdir("scans") if f.endswith(".json")],
            key=lambda x: os.path.getmtime(os.path.join("scans", x)),
            reverse=True
        )
        if latest_scan_files:
            latest_scan_path = os.path.join("scans", latest_scan_files[0])
            with open(latest_scan_path, "r", encoding="utf-8") as f:
                scan_info = json.load(f)

                file_info = scan_info.get("file_info", {})
                scan_results = scan_info.get("scan_results", {})
                process_info = scan_info.get("process_info", {})
                sanitized_info = scan_info.get("sanitized", {})

                scan_summary = f"""
File Name: {file_info.get('display_name', 'Unknown')}
File Size: {file_info.get('file_size', 'Unknown')} bytes
File Type: {file_info.get('file_type_description', 'Unknown')}
SHA256: {file_info.get('sha256', 'Unknown')}
SHA1: {file_info.get('sha1', 'Unknown')}
MD5: {file_info.get('md5', 'Unknown')}
Upload Timestamp: {file_info.get('upload_timestamp', 'Unknown')}
File ID: {scan_info.get('file_id', 'Unknown')}
Data ID: {scan_info.get('data_id', 'Unknown')}

Overall Scan Result: {scan_results.get('scan_all_result_a', 'Unknown')}
Total AV Engines Scanned: {scan_results.get('total_avs', 'Unknown')}
Total Threats Detected: {scan_results.get('total_detected_avs', 'Unknown')}
Scan Start Time: {scan_results.get('start_time', 'Unknown')}
Scanning Duration: {scan_results.get('total_time', 'Unknown')} ms
Scan Progress: {scan_results.get('progress_percentage', 'Unknown')}%

Sanitization Result: {sanitized_info.get('result', 'Unknown')}
Sanitized File Link: {sanitized_info.get('file_path', 'Unavailable')}
Sanitization Progress: {sanitized_info.get('progress_percentage', 'Unknown')}%

Process Info Result: {process_info.get('result', 'Unknown')}
Profile Used: {process_info.get('profile', 'Unknown')}
Verdicts: {', '.join(process_info.get('verdicts', [])) if process_info.get('verdicts') else 'None'}
"""
                scan_context = scan_summary
    except Exception as e:
        print(f"Failed loading latest scan file: {e}")

    doc_context = "\n\n".join([doc.page_content for doc in relevant_docs]) if relevant_docs else ""

    general_prompt = f"""
You are a helpful and knowledgeable chatbot representing OPSWAT, a cybersecurity company.
Answer the user's question to the best of your knowledge. If it's about security, provide detailed, accurate answers.
If it's a general question from another field, do your best to help anyway.

QUESTION: {last_question}
"""

    if not relevant_docs and not scan_context:
        print("No relevant documents or scan found. Generating general response.")
        response = model.generate_content(general_prompt)
        return {"answer": response.text}

    prompt = f"""
You are a helpful assistant for cybersecurity documentation.
Use ONLY the information provided in the context below to answer the user's question.
If the answer is not present in the provided context, say: "The answer is not available in the provided documentation and scan data."

--- CONTEXT START ---
{scan_context}

{doc_context}
--- CONTEXT END ---

QUESTION: {last_question}

Answer clearly using technical language if needed.
"""

    response = model.generate_content(prompt)

    return {"answer": response.text}
