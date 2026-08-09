import os
import json
import time
import math
from collections import Counter
from typing import List, Dict, Any

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "memory_store.json")

def _load_memories() -> List[Dict[str, Any]]:
    if not os.path.exists(MEMORY_FILE):
        return []
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading memory store: {e}")
        return []

def _save_memories(memories: List[Dict[str, Any]]):
    try:
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(memories, f, indent=2)
    except Exception as e:
        print(f"Error saving memory store: {e}")

def add_memory(user_id: str, text: str):
    """
    Stores a piece of user memory/fact into the local vector store.
    """
    text_clean = text.strip()
    if not text_clean or len(text_clean) < 5:
        return

    memories = _load_memories()
    
    # Avoid exact duplicates for the same user
    for mem in memories:
        if mem.get("user_id") == user_id and mem.get("text") == text_clean:
            return
            
    memories.append({
        "user_id": user_id,
        "text": text_clean,
        "timestamp": time.time()
    })
    
    _save_memories(memories)

def _text_to_vector(text: str) -> Counter:
    words = [w.lower() for w in text.split() if len(w) > 2]
    return Counter(words)

def _cosine_sim(vec1: Counter, vec2: Counter) -> float:
    intersection = set(vec1.keys()) & set(vec2.keys())
    numerator = sum([vec1[x] * vec2[x] for x in intersection])

    sum1 = sum([vec1[x] ** 2 for x in vec1.keys()])
    sum2 = sum([vec2[x] ** 2 for x in vec2.keys()])
    denominator = math.sqrt(sum1) * math.sqrt(sum2)

    if not denominator:
        return 0.0
    return float(numerator) / denominator

def search_memory(user_id: str, query: str, top_k: int = 2) -> List[str]:
    """
    Performs vector similarity search on past stored memories for a user.
    Pure Python vector similarity implementation.
    """
    memories = _load_memories()
    user_memories = [m for m in memories if m.get("user_id") == user_id or user_id == "default"]
    
    if not user_memories:
        return []
        
    query_vec = _text_to_vector(query)
    if not query_vec:
        return []

    scored_docs = []
    for mem in user_memories:
        doc_vec = _text_to_vector(mem["text"])
        score = _cosine_sim(query_vec, doc_vec)
        if score > 0.1: # Similarity threshold
            scored_docs.append((score, mem["text"]))

    scored_docs.sort(key=lambda x: x[0], reverse=True)
    return [doc for score, doc in scored_docs[:top_k]]

def get_user_memories(user_id: str) -> List[str]:
    """
    Returns all stored memories for a specific user.
    """
    memories = _load_memories()
    return [m["text"] for m in memories if m.get("user_id") == user_id or user_id == "default"]

def clear_user_memories(user_id: str):
    """
    Deletes all stored memories for a specific user.
    """
    memories = _load_memories()
    filtered = [m for m in memories if m.get("user_id") != user_id and m.get("user_id") != "default"]
    _save_memories(filtered)

