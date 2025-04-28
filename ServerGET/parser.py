# parser.py
from typing import Dict, Any

def parse_metadefender_result(json_data: Dict[str, Any]) -> str:
    """
    Converts a Metadefender API JSON response into a clean, readable text format.
    """
    parts = []

    file_info = json_data.get("file_info", {})
    scan_results = json_data.get("scan_results", {})
    process_info = json_data.get("process_info", {})
    sanitized = json_data.get("sanitized", {})

    parts.append(f"**Scanned File:** {file_info.get('display_name', 'Unknown')}")
    parts.append(f"File Type: {file_info.get('file_type_description', 'Unknown')} ({file_info.get('file_type_extension', '')})")
    parts.append(f"Size: {file_info.get('file_size', 0)} bytes")
    parts.append(f"SHA256 Hash: {file_info.get('sha256', '')}")
    parts.append("")

    parts.append(f"**Overall Scan Result:** {scan_results.get('scan_all_result_a', 'Unknown')}")
    parts.append(f"Total Antivirus Engines Used: {scan_results.get('total_avs', 0)}")
    parts.append(f"Total Detections: {scan_results.get('total_detected_avs', 0)}")
    parts.append("")

    parts.append("**Antivirus Scan Details:**")
    for av_name, av_data in scan_results.get("scan_details", {}).items():
        threat = av_data.get("threat_found", "")
        if threat:
            parts.append(f"- {av_name}: Threat found - '{threat}'")
        else:
            parts.append(f"- {av_name}: No threat found.")

    parts.append("")
    parts.append(f"**Sanitization Result:** {sanitized.get('result', 'Unknown')}")
    if sanitized.get("file_path"):
        parts.append(f"Sanitized file available at: {sanitized['file_path']}")

    parts.append("")
    verdicts = process_info.get("verdicts", [])
    if verdicts:
        parts.append(f"**Additional Verdicts:** {', '.join(verdicts)}")

    return "\n".join(parts)

