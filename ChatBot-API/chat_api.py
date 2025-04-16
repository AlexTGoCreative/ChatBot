from fastapi import FastAPI
from pydantic import BaseModel
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

class Message(BaseModel):
    question: str

@app.post("/ask")
def ask(message: Message):
    retriever = vectordb.as_retriever()
    relevant_docs = retriever.invoke(message.question)

    model = genai.GenerativeModel("models/gemini-2.0-flash")

    def general_prompt(question):
        return f"""
You are a helpful and knowledgeable chatbot representing OPSWAT, a cybersecurity company.
Answer the user's question to the best of your knowledge. If it's about security, provide detailed, accurate answers.
If it's a general question from another field, do your best to help anyway.

QUESTION: {question}
"""

    if not relevant_docs:
        print("No relevant documents found. Generating general OPSWAT-style response.")
        response = model.generate_content(general_prompt(message.question))
        return {"answer": response.text}

    print(f"Found {len(relevant_docs)} relevant docs.")
    context = "\n\n".join([doc.page_content for doc in relevant_docs])

    prompt = f"""
You are a helpful assistant for cybersecurity documentation.
Use ONLY the information provided in the context below to answer the user's question.
If the answer is not present in the context, say "The answer is not available in the provided documentation."
Do not use outside knowledge.

--- DOCUMENTATION CONTEXT START ---
{context}
--- DOCUMENTATION CONTEXT END ---

QUESTION: {message.question}

Answer clearly using technical language if needed.
"""

    response = model.generate_content(prompt)

    if response.text.strip() == "The answer is not available in the provided documentation.":
        print("Fallback triggered. Using general OPSWAT-style response.")
        response = model.generate_content(general_prompt(message.question))

    return {"answer": response.text}
