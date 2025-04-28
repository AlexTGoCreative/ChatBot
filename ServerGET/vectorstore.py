# vectorstore.py
import chromadb
from chromadb.config import Settings

def get_chroma_client():
    return chromadb.Client(Settings(anonymized_telemetry=False))

def store_in_chroma(document_text: str, doc_id: str, collection_name: str = "metadefender_scan"):
    """
    Stores a document into ChromaDB vectorstore.
    """
    client = get_chroma_client()
    collection = client.get_or_create_collection(name=collection_name)

    collection.add(
        documents=[document_text],
        metadatas=[{"source": "metadefender"}],
        ids=[doc_id]
    )

def query_chroma(question: str, collection_name: str = "metadefender_scan") -> str:
    """
    Queries ChromaDB for the most relevant document.
    """
    client = get_chroma_client()
    collection = client.get_or_create_collection(name=collection_name)

    results = collection.query(
        query_texts=[question],
        n_results=1
    )

    if results['documents']:
        return results['documents'][0][0]  # the best matching document
    else:
        return None
