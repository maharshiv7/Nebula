import json
from typing import Any, Dict

def format_sse(event_type: str, content: Any) -> str:
    """
    Formats a given event type and content into a Server-Sent Event (SSE) string.
    Expected format for SSE:
    data: {"type": "event_type", "content": "..."}\n\n
    """
    data: Dict[str, Any] = {
        "type": event_type,
        "content": content
    }
    return f"data: {json.dumps(data)}\n\n"
