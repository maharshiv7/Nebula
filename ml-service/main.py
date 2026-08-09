import os
import base64
import io
import json
import time
import pdfplumber
import docx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from dotenv import load_dotenv

from stream_manager import format_sse
from web_search import perform_search
from model_router import route_query
from monitoring.usage_tracker import log_request
from verifier import verify_output
from memory import add_memory, search_memory, get_user_memories, clear_user_memories

# Load environment variables
load_dotenv(dotenv_path="../.env")

app = FastAPI(title="AI Assistant ML Service")

# Allow requests from backend/frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
try:
    groq_client = Groq()
except Exception as e:
    print(f"Warning: Failed to initialize Groq client. Check GROQ_API_KEY. Error: {e}")
    groq_client = None


@app.get("/")
def read_root():
    return {"status": "ML Service is running"}


@app.get("/memory/{user_id}")
def get_memories(user_id: str):
    memories = get_user_memories(user_id)
    return {"memories": memories}


@app.delete("/memory/{user_id}")
def delete_memories(user_id: str):
    clear_user_memories(user_id)
    return {"message": "Memories cleared successfully"}



def needs_web_search(query: str) -> bool:
    """
    Fast LLM call to classify if the query needs real-time information or external facts.
    """
    if not groq_client:
        return False

    prompt = f"""
    Determine if the following user query requires searching the web for real-time information, recent events, or specific external facts.
    Respond with ONLY 'YES' or 'NO'.
    Query: "{query}"
    """

    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-20b",
            temperature=0,
            max_tokens=10
        )
        return "YES" in completion.choices[0].message.content.upper()
    except:
        return False


@app.post("/chat")
async def chat(request: Request):
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq client not initialized. Missing API key.")

    content_type = request.headers.get("content-type", "")
    file_bytes = None
    filename = ""
    file_mime = ""
    message = ""
    user_id = "default"

    tier = "standard"
    history = []
    # Parse request based on Content-Type header
    if "multipart/form-data" in content_type:
        form_data = await request.form()
        message = str(form_data.get("message", ""))
        user_id = str(form_data.get("user_id", "default"))
        tier = str(form_data.get("tier", "standard"))
        history_raw = form_data.get("history", "[]")
        if isinstance(history_raw, str):
            try:
                history = json.loads(history_raw)
            except Exception:
                history = []
        elif isinstance(history_raw, list):
            history = history_raw

        file_obj = form_data.get("file")
        if file_obj and hasattr(file_obj, "read"):
            file_bytes = await file_obj.read()
            filename = getattr(file_obj, "filename", "") or ""
            file_mime = getattr(file_obj, "content_type", "") or ""
    else:
        try:
            body = await request.json()
            message = str(body.get("message", ""))
            user_id = str(body.get("user_id", "default"))
            tier = str(body.get("tier", "standard"))
            history_raw = body.get("history", [])
            if isinstance(history_raw, str):
                try:
                    history = json.loads(history_raw)
                except Exception:
                    history = []
            elif isinstance(history_raw, list):
                history = history_raw
        except:
            message = ""
            user_id = "default"
            tier = "standard"
            history = []

    async def generate_response():
        start_time = time.time()
        do_search = False
        selected_model = route_query(message, tier)

        try:
            # 1. Consult long-term memory
            yield format_sse("status", "Consulting long-term memory...")
            recalled_memories = search_memory(user_id, message)

            system_prompt = (
                "You are AI Assistant, a personal AI project built by Maharshi Vyas. "
                "If asked who made you, who created you, or how you were built, always say you "
                "were built by Maharshi Vyas as a personal project. Do NOT mention OpenAI, Groq, "
                "or any underlying model provider/company by name, even if asked directly. "
                "\n\nTONE AND STYLE: "
                "Talk like a genuine, warm friend having a real conversation - not like a "
                "corporate assistant. For personal, emotional, or relationship topics "
                "specifically: NEVER use tables, numbered step-by-step frameworks, or "
                "clinical headers like 'Quick Tips' or 'Remember'. Instead, just talk it "
                "through in plain paragraphs, like you're texting a close friend who came to "
                "you for advice. Be encouraging, be real, use casual language, and don't be "
                "afraid to have a bit of personality or gentle humor where it fits. Skip the "
                "structured breakdowns entirely for this kind of conversation - they make "
                "genuine advice feel like a corporate checklist. "
                "For technical, factual, or how-to topics (coding, math, instructions), "
                "structured formatting (tables, steps, headers) is still appropriate and "
                "helpful - use your judgment based on what the person is actually asking about. "
                "\n\nFORMATTING RULES FOR MATH: "
                "Always wrap ALL mathematical expressions in proper LaTeX delimiters - use "
                "$$ ... $$ for standalone/block equations (on their own line), and $ ... $ "
                "for inline math within a sentence. NEVER use plain square brackets like "
                "[ ... ] to denote a math expression - only use $ or $$ delimiters. "
                "\n\nFORMATTING RULES FOR TABLES: "
                "When creating a table, use proper Markdown table syntax with each row on its "
                "own separate line, including the header separator row (e.g., |---|---|). "
                "Never put multiple table rows on the same line. "
                "\n\nOtherwise, be a helpful and concise AI assistant."
            )

            if recalled_memories:
                memory_ctx = "\n".join([f"- {m}" for m in recalled_memories])
                system_prompt += f"\n\nRelevant context recalled from long-term memory:\n{memory_ctx}\n\nUse this context to accurately answer the user."
                yield format_sse("memory_recalled", recalled_memories)

            # 2. File Upload Processing
            is_image = False
            image_b64 = None
            image_mime = "image/png"

            if file_bytes:
                fn_lower = filename.lower()

                # Check for IMAGE (.png, .jpg, .jpeg, .webp)
                if any(fn_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]) or file_mime.startswith("image/"):
                    yield format_sse("status", "Analyzing image...")
                    is_image = True
                    image_b64 = base64.b64encode(file_bytes).decode("utf-8")
                    if fn_lower.endswith(".jpg") or fn_lower.endswith(".jpeg"):
                        image_mime = "image/jpeg"
                    elif fn_lower.endswith(".webp"):
                        image_mime = "image/webp"
                    else:
                        image_mime = "image/png"

                    # Switch to active Groq Vision Model
                    selected_model = "qwen/qwen3.6-27b"

                # Check for PDF (.pdf)
                elif fn_lower.endswith(".pdf") or "pdf" in file_mime:
                    yield format_sse("status", "Reading PDF file...")
                    try:
                        extracted_text = ""
                        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                            for page in pdf.pages:
                                page_text = page.extract_text()
                                if page_text:
                                    extracted_text += page_text + "\n"

                        if extracted_text.strip():
                            system_prompt += f"\n\nExtracted text content from uploaded PDF document '{filename}':\n{extracted_text[:4000]}"
                            yield format_sse("extracted_file_text", extracted_text[:4000])
                        else:
                            yield format_sse("status", "PDF file processed (no text extracted).")
                    except Exception as p_err:
                        print(f"Error parsing PDF: {p_err}")
                        yield format_sse("status", "Failed to parse PDF document.")

                # Check for DOCX (.docx)
                elif fn_lower.endswith(".docx") or "word" in file_mime:
                    yield format_sse("status", "Reading Word document...")
                    try:
                        doc = docx.Document(io.BytesIO(file_bytes))
                        extracted_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

                        if extracted_text.strip():
                            system_prompt += f"\n\nExtracted text content from uploaded Word document '{filename}':\n{extracted_text[:4000]}"
                            yield format_sse("extracted_file_text", extracted_text[:4000])
                        else:
                            yield format_sse("status", "Word document processed (empty).")
                    except Exception as d_err:
                        print(f"Error parsing DOCX: {d_err}")
                        yield format_sse("status", "Failed to parse Word document.")

            # 3. Web Search Classification & Execution (only if not image)
            if not is_image:
                do_search = needs_web_search(message)
                if do_search:
                    yield format_sse("status", "Searching the web...")
                    search_data = perform_search(message)
                    if search_data.get("context"):
                        system_prompt += f"\n\nHere is context from the web:\n{search_data['context']}\n\nCite your sources if used."
                        yield format_sse("sources", search_data["sources"])

            # Send model_info event
            yield format_sse("model_info", selected_model)

            # 4. Construct messages payload
            messages = [{"role": "system", "content": system_prompt}]

            if history and isinstance(history, list):
                for item in history:
                    if isinstance(item, dict) and "role" in item and "content" in item:
                        messages.append({
                            "role": str(item["role"]),
                            "content": str(item["content"]) if not isinstance(item["content"], (str, list)) else item["content"]
                        })

            if is_image and image_b64:
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": message},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image_mime};base64,{image_b64}"
                            }
                        }
                    ]
                })
            else:
                messages.append({"role": "user", "content": message})

            yield format_sse("status", "thinking")

            # 5. Call Groq API with stream=True
            # Note: Groq's SDK does not support OpenAI's stream_options param.
            # Usage data instead arrives on the final chunk under `x_groq.usage`.
            chat_completion = groq_client.chat.completions.create(
                messages=messages,
                model=selected_model,
                temperature=0.7,
                max_tokens=2048 if selected_model == "qwen/qwen3.6-27b" else 1024,
                stream=True
            )

            full_response = ""
            thinking_content = ""
            actual_token_count = 0
            last_chunk = None
            in_thinking_block = False
            raw_buffer = ""

            for chunk in chat_completion:
                last_chunk = chunk
                if hasattr(chunk, "choices") and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        raw_buffer += delta

                        # Detect start of a <think> block
                        if not in_thinking_block and "<think>" in raw_buffer:
                            in_thinking_block = True
                            raw_buffer = raw_buffer.split("<think>", 1)[1]

                        if in_thinking_block:
                            if "</think>" in raw_buffer:
                                # Thinking block just ended - capture it, then continue with the rest as the real answer
                                think_part, rest = raw_buffer.split("</think>", 1)
                                thinking_content += think_part
                                in_thinking_block = False
                                raw_buffer = ""
                                if rest.strip():
                                    full_response += rest
                                    yield format_sse("token", rest)
                            else:
                                thinking_content += delta
                        else:
                            full_response += delta
                            yield format_sse("token", delta)

            # Send the captured thinking process as a separate event (for the Transparency Log)
            if thinking_content.strip():
                yield format_sse("thinking_process", thinking_content.strip())

            # Fallback if the model produced no actual answer (e.g. ran out of
            # max_tokens while still inside its <think> block)
            if not full_response.strip():
                fallback_msg = "I wasn't able to generate a complete response. Please try rephrasing your question or try again."
                yield format_sse("token", fallback_msg)
                full_response = fallback_msg

            # Extract usage from the final chunk's x_groq attribute
            if last_chunk is not None:
                groq_meta = getattr(last_chunk, "x_groq", None)
                if groq_meta is not None:
                    usage = getattr(groq_meta, "usage", None)
                    if usage is not None:
                        actual_token_count = getattr(usage, "total_tokens", 0)

            # Fallback estimation if usage missing from stream
            if actual_token_count == 0:
                actual_token_count = max(10, len(full_response.split()) + len(message.split()) + 20)

            # Yield token usage event
            yield format_sse("token_usage", actual_token_count)

            # 6. Verification check
            yield format_sse("status", "Verifying output...")
            verification_result = verify_output(message, full_response)
            yield format_sse("verification", verification_result)

            yield format_sse("done", True)

            # 7. Auto-save memory (only user message text, NOT file contents)
            msg_lower = message.lower()
            memory_triggers = ["my name", "i am", "i live", "i work", "remember", "my favorite", "i prefer", "i have"]
            if any(trigger in msg_lower for trigger in memory_triggers):
                add_memory(user_id, message)

        except Exception as e:
            print(f"Error in ML generation: {e}")
            yield format_sse("error", str(e))
        finally:
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000
            log_request(message, selected_model, latency_ms, do_search)

    return StreamingResponse(generate_response(), media_type="text/event-stream")