from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import google.generativeai as genai
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from fastapi.middleware.cors import CORSMiddleware
import shutil
from langdetect import detect
from functools import lru_cache
import time
import logging
from datetime import datetime
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('chatbot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PerformanceMonitor:
    def __init__(self):
        self.metrics = []

    def record_metric(self, operation: str, duration: float):
        """Record a performance metric ensuring duration is a float"""
        try:
            # Ensure duration is a float
            duration_float = float(duration) if duration is not None else 0.0
            
            self.metrics.append({
                "timestamp": datetime.now().isoformat(),
                "operation": operation,
                "duration": duration_float
            })
            if len(self.metrics) > 1000:  
                self.metrics = self.metrics[-1000:]
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid duration value for {operation}: {duration}, error: {e}")

    def get_average_duration(self, operation: str) -> float:
        relevant_metrics = [m for m in self.metrics if m["operation"] == operation]
        if not relevant_metrics:
            return 0.0
        return sum(m["duration"] for m in relevant_metrics) / len(relevant_metrics)

performance_monitor = PerformanceMonitor()

# Cache configuration
CACHE_SIZE = 1000
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

@lru_cache(maxsize=CACHE_SIZE)
def get_cached_response(question: str) -> Optional[str]:
    return None  # Implement actual caching logic

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or "AIzaSyDmsf6rzcUXcFLt2JG1YyAGSR0Ixbdi7oY"
genai.configure(api_key=GOOGLE_API_KEY)

DB_DIR = "chroma_db"


def should_rebuild_db():
    
    meta_path = os.path.join(DB_DIR, "meta.json")
    if not os.path.exists(meta_path):
        return True
    with open(meta_path) as f:
        meta = json.load(f)
    return meta.get("model_name") != "sentence-transformers/all-mpnet-base-v2"

    
DOC_PATH = "scraped_html/hash_lookup.txt"
loader = TextLoader(DOC_PATH, encoding="utf-8")
documents = loader.load()
splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    length_function=len,
    separators=["\n\n", "\n", " ", ""]
)
chunks = splitter.split_documents(documents)

embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")

def initialize_vectorstore():
    start_time = time.time()  # This returns a float
    try:
        if os.path.exists(DB_DIR):
            vectordb = Chroma(persist_directory=DB_DIR, embedding_function=embedding_model)
            logger.info("VectorStore loaded from disk")
        else:
            vectordb = Chroma.from_documents(chunks, embedding=embedding_model, persist_directory=DB_DIR)
            logger.info("VectorStore created and persisted")
        
        duration = time.time() - start_time  # Both are floats now
        performance_monitor.record_metric("vectorstore_init", duration)
        return vectordb
    except Exception as e:
        logger.error(f"Error initializing vector store: {str(e)}")
        raise

vectordb = initialize_vectorstore()

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
    url_data : Optional[Dict] = None 

@app.post("/ask")
async def ask(payload: ChatPayload):
    start_time = time.time()  # Ensure this is a float
    
    try:
        if cached_response := get_cached_response(str(payload)):
            logger.info("Cache hit for question")
            return {"answer": cached_response}

        last_question = next((msg.text for msg in reversed(payload.chat_history) if msg.role == "user"), None)
        if not last_question:
            raise HTTPException(status_code=400, detail="No question found in chat history")

        history_context = "\n".join([f"{msg.role.capitalize()}: {msg.text}" for msg in payload.chat_history]) if payload.chat_history else ""

        retriever = vectordb.as_retriever(
            search_type="mmr",  
            search_kwargs={
                "k": 5,
                "fetch_k": 20,
                "lambda_mult": 0.5
            }
        )
        
        relevant_docs = retriever.invoke(last_question)
        
        reranked_docs = sorted(
            relevant_docs,
            key=lambda x: x.metadata.get("score", 0),
            reverse=True
        )

        model = genai.GenerativeModel("models/gemini-2.0-flash")

        scan_results = payload.scan_results or {}
        file_info = payload.file_info or {}
        process_info = payload.process_info or {}
        sanitized_info = payload.sanitized_info or {}
        sandbox_data = payload.sandbox_data or {}
        url_data = payload.url_data or {}

        scan_context = ""
        
        if any([file_info, scan_results, process_info, sanitized_info, sandbox_data, url_data]):
            scan_context = "Available Context Information:\n"
            
            if file_info:
                scan_context += f"""  
File Name: {file_info.get('display_name', 'Unknown')}
File Size: {file_info.get('file_size', 'Unknown')} bytes
File Type: {file_info.get('file_type_description', 'Unknown')} 
SHA256: {file_info.get('sha256', 'Unknown')}
SHA1: {file_info.get('sha1', 'Unknown')}
MD5: {file_info.get('md5', 'Unknown')}
Upload Timestamp: {file_info.get('upload_timestamp', 'Unknown')}
File ID: {file_info.get('file_id', 'Unknown')}
Data ID: {file_info.get('data_id', 'Unknown')}
"""

            if scan_results:
                # Fix potential string values that should be numbers
                scan_context += f"""
Overall Scan Result: {scan_results.get('scan_all_result_a', 'Unknown')}
Total AV Engines Scanned: {scan_results.get('total_avs', 'Unknown')}
Total Threats Detected: {scan_results.get('total_detected_avs', 'Unknown')}
Scan Start Time: {scan_results.get('start_time', 'Unknown')}
Scanning Duration: {scan_results.get('total_time', 'Unknown')} ms
Scan Progress: {scan_results.get('progress_percentage', 'Unknown')}%
"""

            if sanitized_info:
                scan_context += f"""
Sanitization Result: {sanitized_info.get('result', 'Unknown')}
Sanitized File Link: {sanitized_info.get('file_path', 'Unavailable')}
Sanitization Progress: {sanitized_info.get('progress_percentage', 'Unknown')}%
"""

            if process_info:
                verdicts = ', '.join(process_info.get("verdicts", [])) if process_info.get("verdicts") else "None"
                scan_context += f"""
Process Info Result: {process_info.get('result', 'Unknown')}
Profile Used: {process_info.get('profile', 'Unknown')}
Verdicts: {verdicts}
"""

            if sandbox_data:
                final_verdict = sandbox_data.get('final_verdict', {})
                scan_context += f"""
Sandbox Scan Engine: {sandbox_data.get('scan_with', 'Unknown')}
Sandbox Final Verdict: {final_verdict.get('verdict', 'Unknown')}
Threat Level: {final_verdict.get('threatLevel', 'Unknown')}
Confidence Score: {final_verdict.get('confidence', 'Unknown')}
Sandbox Report Link: {sandbox_data.get('store_at', 'Unavailable')}
"""

            if url_data:
                lookup_results = url_data.get("lookup_results", {})
                address = url_data.get("address", "Unknown")
                start_time_url = lookup_results.get("start_time", "Unknown")  # Renamed to avoid conflict
                detected_by = lookup_results.get("detected_by", "Unknown")
                sources = lookup_results.get("sources", [])

                sources_summary = ""
                for src in sources:
                    sources_summary += f"""
Provider: {src.get('provider', 'N/A')}
Assessment: {src.get('assessment', 'N/A')}
Category: {src.get('category', 'N/A')}
Status Code: {src.get('status', 'N/A')}
Update Time: {src.get('update_time', 'N/A')}
"""

                scan_context += f"""
Scanned URL: {address}
URL Lookup Start Time: {start_time_url}
AV Engines Detected: {detected_by}
URL Source Reports:{sources_summary}
"""

        # Detect language safely
        try:
            lang = detect(last_question)
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
            lang = "en"  # Default to English

        doc_context = "\n\n".join([doc.page_content for doc in reranked_docs]) if reranked_docs else ""

        prompt = f"""You are OPSWAT's advanced cybersecurity assistant. Please provide a detailed answer to the following question.

Question: {last_question}

"""
        if history_context:
            prompt += f"""
Chat History:
{history_context}
"""

        if doc_context:
            prompt += f"""
Relevant Documentation:
{doc_context}
"""

        if scan_context:
            prompt += f"""
Analysis Context:
{scan_context}
"""

        response = model.generate_content(prompt)
        
        # Ensure both times are floats before subtraction
        end_time = time.time()
        duration = end_time - start_time
        performance_monitor.record_metric("total_request", duration)
        
        return {"answer": response.text}
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        # Still try to record metrics even on error
        try:
            end_time = time.time()
            duration = end_time - start_time
            performance_monitor.record_metric("failed_request", duration)
        except Exception as metric_error:
            logger.warning(f"Failed to record error metrics: {metric_error}")
        
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    return {
        "average_request_time": performance_monitor.get_average_duration("total_request"),
        "average_vectorstore_init_time": performance_monitor.get_average_duration("vectorstore_init"),
        "total_requests": len([m for m in performance_monitor.metrics if m["operation"] == "total_request"]),
        "failed_requests": len([m for m in performance_monitor.metrics if m["operation"] == "failed_request"])
    }
