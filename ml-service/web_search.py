import os
from tavily import TavilyClient

# Initialize Tavily client (uses TAVILY_API_KEY from environment)
# If the key is not set, we'll handle the error gracefully during the search
try:
    tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
except Exception as e:
    print(f"Warning: Failed to initialize Tavily client. Check TAVILY_API_KEY. Error: {e}")
    tavily_client = None

def perform_search(query: str, max_results: int = 3) -> dict:
    """
    Performs a web search using the Tavily API.
    Returns a dict with a string 'context' and a list of 'sources'.
    """
    if not tavily_client:
        return {"context": "", "sources": []}
    
    try:
        # Search for context
        response = tavily_client.search(
            query=query, 
            search_depth="basic",
            max_results=max_results
        )
        
        results = response.get("results", [])
        
        # Build context string for the LLM
        context = ""
        sources = []
        
        for i, result in enumerate(results):
            context += f"Source [{i+1}]: {result['title']}\nURL: {result['url']}\nContent: {result['content']}\n\n"
            sources.append({
                "title": result['title'],
                "url": result['url']
            })
            
        return {
            "context": context.strip(),
            "sources": sources
        }
    except Exception as e:
        print(f"Error performing web search: {e}")
        return {"context": "", "sources": []}
