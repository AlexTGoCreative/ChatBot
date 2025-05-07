import os
import requests
import json
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  
    allow_headers=["*"],  
)

MD_API_KEY = os.getenv("METADEFENDER_API_KEY")
if not MD_API_KEY:
    raise RuntimeError("Missing METADEFENDER_API_KEY in environment")

@app.post("/scan-file")
async def scan_file(file: UploadFile = File(...)):
    headers = {"apikey": MD_API_KEY}
    scan_url = "https://api.metadefender.com/v4/file"
    
    try:
        file_data = await file.read()
        files = {'file': (file.filename, file_data)}
        resp = requests.post(scan_url, headers=headers, files=files)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        
        response_data = resp.json()
        # print("Response JSON:", response_data)
        hash = response_data.get("data_id")
        return {"message": "File scan initiated", "hash": hash}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan-url")
async def scan_url(url: str):
    headers = {"apikey": MD_API_KEY}
    scan_url = "https://api.metadefender.com/v4/url"
    
    try:
        data = {'url': url}
        resp = requests.post(scan_url, headers=headers, data=json.dumps(data))
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        
        response_data = resp.json()
        hash = response_data.get("data_id")
        
        return {"message": "URL scan initiated", "hash": hash}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scan/{hash}")
def scan_status(hash: str):
    url = f"https://api.metadefender.com/v4/file/{hash}"
    headers = {"apikey": MD_API_KEY}
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

        return resp.json()

    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))