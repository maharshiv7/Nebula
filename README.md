# AI Assistant - Enterprise Full-Stack GenAI Platform

An end-to-end, high-performance conversational AI platform built with a MERN stack backend and a dedicated Python/FastAPI microservice for LLM orchestration. Powered by the Groq LPU Inference Engine, the application delivers real-time streaming responses, multi-tier model routing, RAG-driven long-term memory, live web search grounding, and multi-format document analysis.

---

## 🌟 Key Features

- **⚡ Real-Time SSE Streaming**: Low-latency token-by-token streaming response delivery utilizing Server-Sent Events (SSE) proxied cleanly from FastAPI through Express to React.
- **🎛️ Tiered Model Routing & Token Budgets**: Multi-tier model selection (Lite, Standard, Pro) routed dynamically across high-speed open models (e.g., Llama 3 8B, Llama 3 70B, Qwen). Features weighted daily token usage calculations backed by MongoDB to enforce fair usage quotas (Free: 1k, Pro: 1M tokens/day).
- **🧠 RAG-Style Long-Term Memory**: Automatic context extraction and TF-IDF vector similarity search (`scikit-learn` + `numpy`) to recall user facts and conversation history across sessions.
- **🌐 Live Web Search Grounding**: Integrates Tavily Web Search API to retrieve real-time facts, returning source citations and verification badges directly in the chat UI.
- **📄 Multi-Format File & Vision Analysis**: Drag-and-drop attachment pipeline supporting PDFs (`pdfplumber`), DOCX files (`python-docx`), and images for LLM multi-modal processing.
- **🔍 Response Verification & Self-Correction**: Microservice audit layer (`verifier.py`) that evaluates LLM output consistency, hallucination risk, and formatting prior to final stream completion.
- **✏️ Interactive Message Controls**: Seamless message editing with tree truncation (forking chats from edited nodes), response regeneration, raw copy-to-clipboard, and math rendering ($\text{\LaTeX}$ / KaTeX & Markdown).
- **🎨 Glassmorphic WebGL Interface**: Dark-mode aesthetic featuring WebGL GLSL shader animations (React Bits Orb engine via `ogl`), responsive mobile slide-in drawer, and transparent reasoning pipeline logs.

---

## 🛠️ Tech Stack

### **Frontend (`/frontend`)**
- **Framework**: React 19 + Vite
- **Styling**: TailwindCSS v4
- **Graphics & Icons**: WebGL (`ogl`), Lucide React
- **Markdown & Math**: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`
- **Routing & HTTP**: `react-router-dom`, `axios`

### **Backend (`/backend`)**
- **Runtime**: Node.js & Express
- **Database**: MongoDB with Mongoose ORM
- **Security & Auth**: JSON Web Tokens (JWT), Bcrypt, Express Rate Limit (`express-rate-limit`)
- **File Handling & Communication**: Multer, Axios (SSE proxy)

### **ML & Orchestration Service (`/ml-service`)**
- **Framework**: Python 3.10+, FastAPI, Uvicorn
- **LLM Engine**: Groq SDK (LPU accelerated inference)
- **Web Search**: Tavily Search API (`tavily-python`)
- **Vector Search & Memory**: `scikit-learn`, `numpy` (TF-IDF Cosine Similarity)
- **Document Parsing**: `pdfplumber`, `python-docx`

---

## 📐 Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                       React 19 + Vite UI (Port 5173)                              |
|              (WebGL Shaders, TailwindCSS v4, Markdown/KaTeX Rendering)             |
+-----------------------------------------+-----------------------------------------+
                                          |
                                HTTP / SSE | (JSON / Event Stream)
                                          v
+-----------------------------------------------------------------------------------+
|                                  BACKEND API                                      |
|                       Node.js + Express (Port 5000)                               |
|        (JWT Auth, Rate Limiting, User Budgets, Chat Persistence, SSE Proxy)       |
+-------------------+---------------------------------------+-----------------------+
                    |                                       |
     Mongoose ORM   |                                       | HTTP / SSE Stream
                    v                                       v
+-------------------+--------------+      +-----------------+-----------------------+
|            DATABASE              |      |             ML SERVICE                  |
|     MongoDB (Port 27017)         |      |    Python + FastAPI (Port 8000)         |
| (Users, Chats, Messages, Quotas) |      | (LLM Router, Memory, Search, Verifier)  |
+----------------------------------+      +-----------------+-----------------------+
                                                            |
                                                            | External API Calls
                                                            v
                                          +-----------------+-----------------------+
                                          |            EXTERNAL SERVICES            |
                                          | - Groq API (LPU LLM Engine)             |
                                          | - Tavily Search API (Web Grounding)     |
                                          +-----------------------------------------+
```

---

## 🚀 Setup & Installation

### **Prerequisites**
- **Node.js** (v18+ recommended)
- **Python** (v3.10+ recommended)
- **MongoDB** running locally on port 27017 or a MongoDB Atlas connection URI
- **Groq API Key** ([Get a key from Groq Console](https://console.groq.com/))
- *(Optional)* **Tavily API Key** ([Get a key from Tavily](https://tavily.com/))

---

### **1. Clone the Repository**
```bash
git clone https://github.com/your-username/ai-assistant.git
cd ai-assistant
```

---

### **2. Configure Environment Variables**
Copy the sample `.env.example` file to create your root `.env` file:
```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
```env
# Backend Configuration (Node.js / Express)
PORT=5000
MONGO_URI=mongodb://localhost:27017/ai_assistant
JWT_SECRET=your_super_secret_jwt_key_here

# ML Microservice Configuration (Python / FastAPI)
GROQ_API_KEY=gsk_your_groq_api_key_here
TAVILY_API_KEY=tvly_your_tavily_api_key_here  # Optional for Web Search
```

---

### **3. Install Dependencies**

#### **Backend (`/backend`)**
```bash
cd backend
npm install
cd ..
```

#### **Frontend (`/frontend`)**
```bash
cd frontend
npm install
cd ..
```

#### **ML Service (`/ml-service`)**
```bash
cd ml-service
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
cd ..
```

---

### **4. Running the Project Locally**

Open 3 terminal windows to run each service:

**Terminal 1: Backend Server (Node.js/Express)**
```bash
cd backend
node server.js
```
*(Runs on `http://localhost:5000`)*

**Terminal 2: ML Microservice (FastAPI)**
```bash
cd ml-service
# Activate venv first if not activated
uvicorn main:app --reload
```
*(Runs on `http://localhost:8000`)*

**Terminal 3: Frontend (React/Vite)**
```bash
cd frontend
npm run dev
```
*(Runs on `http://localhost:5173`)*

---

## ⚠️ Known Limitations

- **System-Prompt Identity**: The AI assistant identity and behavioral boundaries are enforced via tailored system prompts rather than custom fine-tuned model weights.
- **Simulated Token Billing**: The token usage and budget meter (Free 1k / Pro 1M daily tokens) calculates weighted API usage to demonstrate tier control, but is not hooked up to a live payment processor (e.g., Stripe).
- **Local Memory Storage**: Long-term TF-IDF vector memory is persisted locally in `memory_store.json` using scikit-learn cosine similarity, which is optimal for single-instance deployments rather than horizontally-scaled production clusters.

---

## 🔮 Future Improvements

Given more development time, planned enhancements include:
- **Distributed Vector DB Migration**: Upgrade local TF-IDF memory to ChromaDB or Qdrant for dense semantic embedding retrieval.
- **Automated Testing Suite**: Implement end-to-end testing with Playwright and API unit testing with PyTest and Jest.
- **Production Containerization**: Multi-stage `Dockerfile` manifests and `docker-compose.yml` for single-command deployment.
- **WebSockets Engine**: Transition SSE streams to bi-directional WebSockets for real-time multi-agent execution status updates.
