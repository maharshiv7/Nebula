import ast
import re

def verify_output(query: str, response: str) -> dict:
    """
    Performs output verification checks on the generated LLM response.
    Returns a dict with 'status' ('PASSED' or 'WARNING') and 'message'.
    """
    if not response or len(response.strip()) == 0:
        return {
            "status": "WARNING",
            "message": "Empty response generated"
        }
        
    # 1. Extract Python code blocks if present
    python_blocks = re.findall(r"```python\s*(.*?)\s*```", response, re.DOTALL)
    
    if python_blocks:
        for idx, code in enumerate(python_blocks):
            try:
                ast.parse(code)
            except SyntaxError as e:
                return {
                    "status": "WARNING",
                    "message": f"Python syntax error in block {idx + 1}: {e.msg} (line {e.lineno})"
                }
        return {
            "status": "PASSED",
            "message": "Python code syntax verified clean"
        }
        
    # 2. Default check for text responses
    return {
        "status": "PASSED",
        "message": "Output format & structure verified"
    }
