from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
from dotenv import load_dotenv
load_dotenv()  # Load .env file before initializing clients

from openai import OpenAI
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from fastapi.middleware.cors import CORSMiddleware
from langdetect import detect
import time
import logging
from datetime import datetime
import json
from sentence_transformers import CrossEncoder
import numpy as np

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

# Chunking configuration
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Reranker configuration
RERANK_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
RERANK_TOP_K = 5          # Max docs to keep after reranking
RERANK_THRESHOLD = 0.1    # Minimum cross-encoder score to include a doc

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# --- Module-level singletons (P0 fixes) ---

# OpenAI client — reads OPENAI_API_KEY from environment automatically
OPENAI_MODEL = "gpt-5.4-nano"
openai_client = OpenAI()  # Uses OPENAI_API_KEY env var
logger.info(f"OpenAI client initialized (model: {OPENAI_MODEL})")

# P0 Step 1: Cross-encoder reranker — loaded once at startup
reranker = CrossEncoder(RERANK_MODEL_NAME)
logger.info(f"Cross-encoder reranker loaded: {RERANK_MODEL_NAME}")

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
    start_time = time.time()
    
    try:
        last_question = next((msg.text for msg in reversed(payload.chat_history) if msg.role == "user"), None)
        if not last_question:
            raise HTTPException(status_code=400, detail="No question found in chat history")

        # --- Retrieval ---
        retrieval_start = time.time()
        retriever = vectordb.as_retriever(
            search_type="mmr",  
            search_kwargs={
                "k": 10,        # Fetch more candidates for reranking
                "fetch_k": 30,
                "lambda_mult": 0.5
            }
        )
        
        relevant_docs = retriever.invoke(last_question)
        performance_monitor.record_metric("retrieval", time.time() - retrieval_start)

        # --- P0 Step 1: Real cross-encoder reranking ---
        rerank_start = time.time()
        if relevant_docs:
            # Score each (query, document) pair with the cross-encoder
            pairs = [[last_question, doc.page_content] for doc in relevant_docs]
            scores = reranker.predict(pairs)
            
            # Attach scores and sort descending
            scored_docs = list(zip(relevant_docs, scores))
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            
            # P0 Step 3: Apply relevance threshold — only keep docs above minimum score
            filtered_docs = [(doc, score) for doc, score in scored_docs if score >= RERANK_THRESHOLD]
            
            # Keep top-k after filtering
            filtered_docs = filtered_docs[:RERANK_TOP_K]
            
            reranked_docs = [doc for doc, _ in filtered_docs]
            top_scores = [float(score) for _, score in filtered_docs]
            
            logger.info(f"Reranking: {len(relevant_docs)} candidates → {len(reranked_docs)} above threshold "
                       f"(threshold={RERANK_THRESHOLD}, top_score={top_scores[0] if top_scores else 'N/A'})")
        else:
            reranked_docs = []
            top_scores = []
        
        performance_monitor.record_metric("reranking", time.time() - rerank_start)

        # --- P0 Step 3: Abstention when no relevant docs found ---
        has_relevant_context = len(reranked_docs) > 0

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

        # Build system instructions (developer role)
        system_instructions = "You are OPSWAT's advanced cybersecurity assistant. Provide a detailed, accurate answer to the user's question."

        if doc_context:
            system_instructions += f"""

Relevant Documentation (use this to ground your answer):
<<<CONTEXT_START>>>
{doc_context}
<<<CONTEXT_END>>>
"""
        elif not scan_context:
            # P0 Step 3: Abstention — no relevant docs AND no scan context
            system_instructions += """

NOTE: No relevant documentation was found for this query. If the question is about MetaDefender, OPSWAT products, or cybersecurity scanning, acknowledge that you don't have specific documentation to reference and provide your best general knowledge answer with a caveat. If the question is a general greeting or conversational, respond naturally."""

        if scan_context:
            system_instructions += f"""

Analysis Context:
{scan_context}
"""

        # Build input messages for OpenAI Responses API
        input_messages = [
            {"role": "developer", "content": system_instructions},
        ]

        # Add chat history as conversation turns
        if payload.chat_history:
            for msg in payload.chat_history:
                role = "user" if msg.role == "user" else "assistant"
                input_messages.append({"role": role, "content": msg.text})
        else:
            input_messages.append({"role": "user", "content": last_question})

        # --- Generation using OpenAI Responses API ---
        generation_start = time.time()
        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            input=input_messages,
        )
        performance_monitor.record_metric("generation", time.time() - generation_start)
        
        # Record total request time
        end_time = time.time()
        duration = end_time - start_time
        performance_monitor.record_metric("total_request", duration)
        
        logger.info(f"Request completed in {duration:.2f}s "
                   f"(retrieval={performance_monitor.metrics[-3]['duration']:.2f}s, "
                   f"rerank={performance_monitor.metrics[-2]['duration']:.2f}s, "
                   f"generation={performance_monitor.metrics[-1]['duration']:.2f}s)")
        
        return {"answer": response.output_text}
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
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
        "average_retrieval_time": performance_monitor.get_average_duration("retrieval"),
        "average_reranking_time": performance_monitor.get_average_duration("reranking"),
        "average_generation_time": performance_monitor.get_average_duration("generation"),
        "average_vectorstore_init_time": performance_monitor.get_average_duration("vectorstore_init"),
        "total_requests": len([m for m in performance_monitor.metrics if m["operation"] == "total_request"]),
        "failed_requests": len([m for m in performance_monitor.metrics if m["operation"] == "failed_request"]),
        "llm_model": OPENAI_MODEL,
        "reranker_model": RERANK_MODEL_NAME,
        "rerank_threshold": RERANK_THRESHOLD,
        "rerank_top_k": RERANK_TOP_K,
    }
