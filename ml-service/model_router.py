def route_query(query: str, tier: str = "standard") -> str:
    """
    Routes the query to active Groq models based on selected tier:
      - 'lite'     -> 'openai/gpt-oss-20b'
      - 'standard' -> 'openai/gpt-oss-120b'
      - 'pro'      -> 'qwen/qwen3.6-27b'
    """
    tier_lower = (tier or "standard").lower()
    
    if tier_lower == "lite":
        return "openai/gpt-oss-20b"
    elif tier_lower == "pro":
        return "qwen/qwen3.6-27b"
    else:
        return "openai/gpt-oss-120b"
