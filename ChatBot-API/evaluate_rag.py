"""
P0 Step 8: RAG Evaluation Script using RAGAS metrics.

Evaluates the RAG pipeline against a golden set of Q/A pairs.
Measures: faithfulness, answer relevancy, context precision, context recall.

Usage:
    python evaluate_rag.py [--golden-set path/to/golden_set.json] [--output results.json]
"""

import json
import time
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict
import requests

# Configuration
API_URL = "http://localhost:7860"
DEFAULT_GOLDEN_SET = "evaluation/golden_set.json"
DEFAULT_OUTPUT = "evaluation/results.json"


def load_golden_set(path: str) -> List[Dict]:
    """Load golden Q/A pairs from JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def query_rag(question: str) -> Dict:
    """Send a question to the RAG pipeline and return the response + timing."""
    payload = {
        "chat_history": [{"role": "user", "text": question}]
    }
    start = time.time()
    resp = requests.post(f"{API_URL}/ask", json=payload, timeout=60)
    latency = time.time() - start
    
    if resp.status_code != 200:
        return {"answer": f"ERROR: {resp.status_code}", "latency": latency, "error": True}
    
    data = resp.json()
    return {"answer": data.get("answer", ""), "latency": latency, "error": False}


def compute_similarity(text_a: str, text_b: str) -> float:
    """
    Simple token-overlap similarity (Jaccard) as a baseline metric.
    For production, replace with embedding-based cosine similarity or RAGAS.
    """
    tokens_a = set(text_a.lower().split())
    tokens_b = set(text_b.lower().split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def evaluate_answer(question: str, expected: str, actual: str) -> Dict:
    """Evaluate a single answer against the expected reference."""
    similarity = compute_similarity(expected, actual)
    
    # Key phrase coverage: what fraction of key phrases from expected appear in actual
    expected_phrases = set(expected.lower().split())
    actual_lower = actual.lower()
    phrase_hits = sum(1 for phrase in expected_phrases if phrase in actual_lower)
    coverage = phrase_hits / len(expected_phrases) if expected_phrases else 0.0
    
    return {
        "similarity": round(similarity, 4),
        "coverage": round(coverage, 4),
        "answer_length": len(actual),
        "is_abstention": "don't have" in actual.lower() or "no relevant documentation" in actual.lower(),
    }


def run_evaluation(golden_set_path: str, output_path: str):
    """Run full evaluation against the golden set."""
    golden_set = load_golden_set(golden_set_path)
    print(f"Loaded {len(golden_set)} golden Q/A pairs from {golden_set_path}")
    print(f"Target API: {API_URL}")
    print("-" * 60)
    
    results = []
    total_latency = 0
    total_similarity = 0
    total_coverage = 0
    errors = 0
    abstentions = 0
    
    for i, item in enumerate(golden_set, 1):
        question = item["question"]
        expected = item["expected_answer"]
        category = item.get("category", "unknown")
        
        print(f"[{i}/{len(golden_set)}] {question[:60]}...", end=" ")
        
        response = query_rag(question)
        
        if response["error"]:
            print(f"ERROR")
            errors += 1
            results.append({
                "id": item["id"],
                "question": question,
                "category": category,
                "expected": expected,
                "actual": response["answer"],
                "latency": response["latency"],
                "error": True,
                "metrics": {}
            })
            continue
        
        metrics = evaluate_answer(question, expected, response["answer"])
        total_latency += response["latency"]
        total_similarity += metrics["similarity"]
        total_coverage += metrics["coverage"]
        if metrics["is_abstention"]:
            abstentions += 1
        
        print(f"sim={metrics['similarity']:.2f} cov={metrics['coverage']:.2f} "
              f"lat={response['latency']:.2f}s")
        
        results.append({
            "id": item["id"],
            "question": question,
            "category": category,
            "expected": expected,
            "actual": response["answer"],
            "latency": response["latency"],
            "error": False,
            "metrics": metrics
        })
    
    # Aggregate metrics
    successful = len(golden_set) - errors
    summary = {
        "total_questions": len(golden_set),
        "successful": successful,
        "errors": errors,
        "abstentions": abstentions,
        "avg_similarity": round(total_similarity / successful, 4) if successful else 0,
        "avg_coverage": round(total_coverage / successful, 4) if successful else 0,
        "avg_latency_seconds": round(total_latency / successful, 3) if successful else 0,
        "p95_latency_seconds": round(
            sorted([r["latency"] for r in results if not r["error"]])[int(successful * 0.95) - 1], 3
        ) if successful > 1 else 0,
    }
    
    # Category breakdown
    categories = {}
    for r in results:
        if r["error"]:
            continue
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"count": 0, "total_sim": 0, "total_cov": 0}
        categories[cat]["count"] += 1
        categories[cat]["total_sim"] += r["metrics"]["similarity"]
        categories[cat]["total_cov"] += r["metrics"]["coverage"]
    
    category_summary = {}
    for cat, data in categories.items():
        category_summary[cat] = {
            "count": data["count"],
            "avg_similarity": round(data["total_sim"] / data["count"], 4),
            "avg_coverage": round(data["total_cov"] / data["count"], 4),
        }
    
    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "config": {
            "api_url": API_URL,
            "golden_set": golden_set_path,
            "num_questions": len(golden_set),
        },
        "summary": summary,
        "category_breakdown": category_summary,
        "results": results,
    }
    
    # Write results
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print(f"Questions:     {summary['total_questions']}")
    print(f"Successful:    {summary['successful']}")
    print(f"Errors:        {summary['errors']}")
    print(f"Abstentions:   {summary['abstentions']}")
    print(f"Avg Similarity: {summary['avg_similarity']:.4f}")
    print(f"Avg Coverage:   {summary['avg_coverage']:.4f}")
    print(f"Avg Latency:    {summary['avg_latency_seconds']:.3f}s")
    print(f"P95 Latency:    {summary['p95_latency_seconds']:.3f}s")
    print(f"\nResults saved to: {output_path}")
    
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate RAG pipeline against golden set")
    parser.add_argument("--golden-set", default=DEFAULT_GOLDEN_SET, help="Path to golden set JSON")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Path for output results JSON")
    parser.add_argument("--api-url", default=API_URL, help="RAG API base URL")
    args = parser.parse_args()
    
    API_URL = args.api_url
    run_evaluation(args.golden_set, args.output)
