import os
import requests
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from parser import parse_metadefender_result
from vectorstore import store_in_chroma

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
    url = f"https://api.metadefender.com/v4/file/{hash}"
    headers = {"apikey": MD_API_KEY}

    try:
        resp = requests.get(url, headers=headers, timeout=10)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.json() if resp.headers.get("Content-Type", "").startswith("application/json") else resp.text
        )

    json_data = resp.json()

    # Parse + store in Chroma
    parsed_text = parse_metadefender_result(json_data)
    store_in_chroma(parsed_text, doc_id=hash)

    # Save files for chatbot
    os.makedirs("../ChatBot-API/scans", exist_ok=True)
    with open(f"../ChatBot-API/scans/{hash}.txt", "w", encoding="utf-8") as f:
        f.write(parsed_text)
    with open(f"../ChatBot-API/scans/{hash}.json", "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2)

    # Build full structured response
    file_info = json_data.get("file_info", {})
    scan_results = json_data.get("scan_results", {})
    process_info = json_data.get("process_info", {})
    sanitized_info = json_data.get("sanitized", {})

    return {
        "message": "Scan parsed, vectorized, and saved for chatbot.",
        "hash": hash,
        "file_info": {
            "file_name": file_info.get("display_name"),
            "file_size": file_info.get("file_size"),
            "sha256": file_info.get("sha256"),
            "file_type": file_info.get("file_type_description"),
            "upload_timestamp": file_info.get("upload_timestamp")
        },
        "scan_summary": {
            "overall_result": scan_results.get("scan_all_result_a"),
            "total_avs": scan_results.get("total_avs"),
            "total_detected": scan_results.get("total_detected_avs"),
            "scan_time_ms": scan_results.get("total_time"),
            "start_time": scan_results.get("start_time"),
            "progress_percentage": scan_results.get("progress_percentage")
        },
        "sanitization_summary": {
            "sanitization_result": sanitized_info.get("result"),
            "sanitized_file_link": sanitized_info.get("file_path"),
            "progress_percentage": sanitized_info.get("progress_percentage")
        },
        "process_info": {
            "result": process_info.get("result"),
            "profile": process_info.get("profile"),
            "verdicts": process_info.get("verdicts"),
            "post_processing": process_info.get("post_processing", {})
        }
    }
