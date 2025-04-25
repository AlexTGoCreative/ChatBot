import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_methods=["GET"],
    allow_headers=["*"],
)

MD_API_KEY = os.getenv("METADEFENDER_API_KEY")
if not MD_API_KEY:
    raise RuntimeError("Missing METADEFENDER_API_KEY in environment")

@app.get("/scan/{hash}")
def scan_file(hash: str):
    """
    Primesc un hash și retrimit rezultatul de la Metadefender.
    """
    url = f"https://api.metadefender.com/v4/file/{hash}"
    headers = {"apikey": MD_API_KEY}
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))
    
    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else resp.text
        )
    
    return resp.json()
