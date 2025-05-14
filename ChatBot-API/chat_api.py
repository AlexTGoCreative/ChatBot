from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Dict
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

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatPayload(BaseModel):
    chat_history: List[ChatMessage]
    scan_results: Optional[Dict] = None  
    file_info: Optional[Dict] = None     
    process_info: Optional[Dict] = None   
    sanitized_info: Optional[Dict] = None 
    sandbox_data: Optional[Dict] = None 

@app.post("/ask")
def ask(payload: ChatPayload):
    # Extract the last user question
    last_question = next((msg.text for msg in reversed(payload.chat_history) if msg.role == "user"), None)
    if not last_question:
        return {"answer": "No question found in chat history."}

    # Build conversation history context
    history_context = "\n".join([f"{msg.role.capitalize()}: {msg.text}" for msg in payload.chat_history])

    retriever = vectordb.as_retriever()
    relevant_docs = retriever.invoke(last_question)

    model = genai.GenerativeModel("models/gemini-2.0-flash")

    scan_results = payload.scan_results or {}
    file_info = payload.file_info or {}
    process_info = payload.process_info or {}
    sanitized_info = payload.sanitized_info or {}
    sandbox_data = payload.sandbox_data or {}

    verdicts = ', '.join(process_info.get("verdicts", [])) if process_info.get("verdicts") else "None"
    scan_all_result = scan_results.get("scan_all_result_a", "Unknown")
    total_avs = scan_results.get("total_avs", "Unknown")
    total_detected_avs = scan_results.get("total_detected_avs", "Unknown")
    scan_time = scan_results.get("start_time", "Unknown")
    duration = scan_results.get("total_time", "Unknown")
    progress = scan_results.get("progress_percentage", "Unknown")

    scan_context = f"""
File Name: {file_info.get('display_name', 'Unknown')}
File Size: {file_info.get('file_size', 'Unknown')} bytes
File Type: {file_info.get('file_type_description', 'Unknown')}
SHA256: {file_info.get('sha256', 'Unknown')}
SHA1: {file_info.get('sha1', 'Unknown')}
MD5: {file_info.get('md5', 'Unknown')}
Upload Timestamp: {file_info.get('upload_timestamp', 'Unknown')}
File ID: {file_info.get('file_id', 'Unknown')}
Data ID: {file_info.get('data_id', 'Unknown')}

Overall Scan Result: {scan_all_result}
Total AV Engines Scanned: {total_avs}
Total Threats Detected: {total_detected_avs}
Scan Start Time: {scan_time}
Scanning Duration: {duration} ms
Scan Progress: {progress}%

Sanitization Result: {sanitized_info.get('result', 'Unknown')}
Sanitized File Link: {sanitized_info.get('file_path', 'Unavailable')}
Sanitization Progress: {sanitized_info.get('progress_percentage', 'Unknown')}%

Process Info Result: {process_info.get('result', 'Unknown')}
Profile Used: {process_info.get('profile', 'Unknown')}
Verdicts: {verdicts}

Sandbox Scan Engine: {sandbox_data.get('scan_with', 'Unknown')}
Sandbox Final Verdict: {sandbox_data.get('final_verdict', {}).get('verdict', 'Unknown')}
Threat Level: {sandbox_data.get('final_verdict', {}).get('threatLevel', 'Unknown')}
Confidence Score: {sandbox_data.get('final_verdict', {}).get('confidence', 'Unknown')}
Sandbox Report Link: {sandbox_data.get('store_at', 'Unavailable')}
"""

    doc_context = "\n\n".join([doc.page_content for doc in relevant_docs]) if relevant_docs else ""

    general_prompt = f"""
You are a helpful and knowledgeable chatbot representing OPSWAT, a cybersecurity company.
Answer the user's question based on the conversation history below, ensuring continuity and context. If the question is about security, provide detailed, accurate answers. If it's a general question from another field, do your best to help.

--- CONVERSATION HISTORY ---
{history_context}
--- END HISTORY ---

QUESTION: {last_question}
"""

    context_prompt = f"""
You are a helpful assistant for cybersecurity documentation.
Use ONLY the information provided in the context below to answer the user's question, while considering the conversation history for context. If the answer is not present in the provided context, say: "The answer is not available in the provided documentation and scan data."

--- CONVERSATION HISTORY ---
{history_context}
--- END HISTORY ---

--- CONTEXT START ---
{scan_context}

{doc_context}
--- CONTEXT END ---

QUESTION: {last_question}

Answer clearly using technical language if needed.
"""

    if doc_context or scan_context:
        response = model.generate_content(context_prompt)

        if response.text.strip() == "The answer is not available in the provided documentation and scan data.":
            print("Fallback triggered. Using general OPSWAT-style response.")
            response = model.generate_content(general_prompt)
    else:
        print("No relevant documents or scan data. Using general model response.")
        response = model.generate_content(general_prompt)

    return {"answer": response.text}