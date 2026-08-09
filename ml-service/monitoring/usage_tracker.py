import json
import os
import datetime

LOG_FILE = os.path.join(os.path.dirname(__file__), "usage_logs.jsonl")

def log_request(query: str, model_used: str, latency_ms: float, web_search_used: bool):
    """
    Logs the usage data for a single request to a local JSONL file.
    """
    log_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "query_preview": query[:50] + ("..." if len(query) > 50 else ""),
        "model_used": model_used,
        "latency_ms": round(latency_ms, 2),
        "web_search_used": web_search_used
    }
    
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"Failed to write usage log: {e}")
