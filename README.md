# Ozzy — AI-Powered Cybersecurity Scanner & Assistant

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)

## Overview

**Ozzy** is a full-stack cybersecurity scanning and analysis platform that combines OPSWAT MetaDefender Cloud multiscanning with an in-house **Agatha Detection AI** engine (ONNX ML-based malware classification) and OpenAI's GPT-5.4 nano model. Users can upload files, submit URLs/IPs, or look up hashes to get multi-engine malware verdicts, sandbox analysis, and then ask an AI assistant context-aware questions about the results — powered by a Retrieval-Augmented Generation (RAG) pipeline built on MetaDefender documentation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend (Vite)                       │
│        File Upload · URL/Hash Input · Chat UI · Engine Settings     │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │                              │
    Scan requests                    Chat messages
    (proxy /scan)                    (proxy /ask)
           │                              │
           ▼                              ▼
┌──────────────────────────┐  ┌───────────────────────────────────────┐
│  Express Server (:5000)  │  │      FastAPI Server (:7860)           │
│                          │  │                                       │
│ • JWT Authentication     │  │ • OpenAI GPT-5.4 nano LLM            │
│ • MetaDefender API Proxy │  │ • Qdrant Vector Store                 │
│ • Agatha engine (in-proc)│  │ • BGE-M3 Embeddings                   │
│ • File upload (multer)   │  │ • RAG pipeline with re-ranking        │
│ • MongoDB (users, hist.) │  │ • Streaming SSE responses             │
└──────────┬───────────────┘  └───────────────────────────────────────┘
           │
     ┌─────┴──────────────┐
     ▼                    ▼
┌──────────────────┐  ┌────────────────────────────────────────────┐
│ MetaDefender     │  │  Agatha Engine (native, in-process)        │
│ Cloud API        │  │                                            │
│ (30+ AV engines, │  │  • andertonengine.dll (loaded via koffi)   │
│  sandbox, URL)   │  │  • ONNX ML inference                       │
└──────────────────┘  │  • UIF `process` + `getWorkflowInfo` FFI   │
                      │  • Per-file-type layers + thresholds       │
                      └────────────────────────────────────────────┘
```

## Features

### Threat Scanning
- **Agatha Detection AI** — In-house ONNX ML engine that classifies files as Clean or Infected (always runs)
- **File scanning** — Upload any file for analysis by 30+ anti-malware engines via MetaDefender (toggleable)
- **URL/IP scanning** — Submit URLs or IP addresses for reputation and threat assessment
- **Hash lookup** — Check file hashes (MD5/SHA1/SHA256) against MetaDefender's database
- **Sandbox analysis** — View dynamic analysis results for submitted samples
- **Detailed results** — Per-engine verdicts, threat scores, file metadata, and detection classifications

### AI Assistant (Ozzy)
- **Context-aware chat** — Ask questions about scan results; the bot has full access to your scan data
- **RAG pipeline** — Retrieves relevant MetaDefender documentation to ground AI responses
- **Multi-language** — Detects query language and responds in kind
- **Chat history** — Conversations persist per-user and can be revisited

### User Management
- **Registration & login** — Secure JWT-based authentication with bcrypt password hashing
- **Scan history** — All file and URL scans are saved and accessible from the chat sidebar
- **Chat history** — Previous conversations with the AI are saved and can be reloaded

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, TailwindCSS 4, Axios, SWR |
| Server | Node.js, Express 5, Mongoose 7, Multer, JWT |
| AI Backend | Python 3.11+, FastAPI, Uvicorn, Qdrant, BGE-M3 |
| ML Engine | Rust (cdylib), ONNX Runtime, koffi (Node.js FFI) |
| LLM | OpenAI GPT-5.4 nano |
| Embeddings | BAAI/bge-m3 (dense + sparse) |
| Database | MongoDB (users, chat/scan history) |
| Vector Store | Qdrant Cloud (MetaDefender docs) |
| External API | OPSWAT MetaDefender Cloud v4 |

## Project Structure

```
├── ozzy-app/                # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgathaSettings/  # Engine configuration panel
│   │   │   ├── Auth/            # Login & Register forms
│   │   │   ├── ChatBot/         # AI chat interface
│   │   │   ├── Form/            # File upload & URL input
│   │   │   ├── LoadingOverlay/  # Scan progress indicator
│   │   │   └── ScanResults/     # Results display & export
│   │   ├── hooks/
│   │   │   └── useFileScan.js   # Scan lifecycle (Agatha + MetaDefender)
│   │   └── utils/
│   │       └── api.js           # HTTP client for Express server
│   ├── package.json
│   └── vite.config.js           # Dev proxy: /scan→:5000, /ask→:7860
│
├── ozzy-api/                # Express API server
│   ├── index.js             # Routes (auth, scan proxy, agatha proxy, history)
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── models/
│   │   ├── User.js          # User schema (username, hashed password)
│   │   ├── ChatHistory.js   # Chat messages + scan context
│   │   └── ScanHistory.js   # File/URL scan records
│   └── package.json
│
├── ozzy-ai/                 # RAG AI backend
│   ├── src/
│   │   ├── main.py          # FastAPI app — /ask, /ask/stream, /health
│   │   ├── retrieval.py     # Qdrant hybrid search (dense + sparse)
│   │   ├── generation.py    # OpenAI Responses API + streaming
│   │   ├── reranking.py     # BGE-reranker-v2-m3 cross-encoder
│   │   └── context.py       # System prompt + scan context assembly
│   ├── scripts/
│   │   ├── scrape_docs.py   # Playwright scraper for MD docs
│   │   └── ingest.py        # Chunk & index into Qdrant
│   ├── requirements.txt
│   └── Dockerfile
│
├── agatha/                  # Agatha engine HTTP wrapper
│   ├── index.js             # Express server wrapping native DLL via koffi
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore           # Ignores package/ folder
│   └── package/             # Engine artifacts (git-ignored)
│       ├── andertonengine.dll
│       ├── model_classifier-*.onnx
│       ├── onnxruntime-avx2.dll
│       ├── falsedetection.txt
│       └── reputation-engine/
│
└── README.md
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **MongoDB** instance (local or Atlas)
- **OPSWAT MetaDefender Cloud API key** — [Get one here](https://metadefender.opswat.com/)
- **OpenAI API key** — [Get one here](https://platform.openai.com/api-keys)
- **Agatha engine build** — Compiled `andertonengine.dll` + ONNX model (from `agatha-engine` repo)

## Environment Variables

Create a `.env` file in each service directory:

### `ozzy-app/.env`
```env
VITE_METADEFENDER_API_KEY=your_metadefender_api_key
VITE_API2_URL=http://localhost:5000
```

### `ozzy-api/.env`
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ozzy
METADEFENDER_API_KEY=your_metadefender_api_key
JWT_SECRET=your_jwt_secret
# Optional — override the native engine package directory.
# Defaults to ozzy-api/engine/package.
# AGATHA_PACKAGE_DIR=./engine/package
```

### `ozzy-ai/.env`
```env
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
REDIS_URL=redis://localhost:6379/0
```

## Getting Started

### 1. Clone the repository

```bash
git clone --recurse-submodules https://github.com/AlexTGoCreative/Ozzy
cd Ozzy
```

> If you already cloned without `--recurse-submodules`, run:
> ```bash
> git submodule update --init --recursive
> ```

### 2. Provide the native Agatha engine package

The engine DLL and ONNX models are loaded in-process by `ozzy-api`. Place the
built engine package under `ozzy-api/engine/package/`:

```bash
# From the agatha-engine repo after building:
cp -r target/package/* ../ChatBot/ozzy-api/engine/package/
```

The directory should contain `andertonengine.dll` (or `libandertonengine.so`),
the `onnxruntime-*` libraries, the `model_*.onnx` files, `falsedetection.txt`,
and the `reputation-engine/` folder. If the DLL is missing, `ozzy-api` still
starts and Agatha scans report "engine unavailable".

### 3. Start the Express Server

```bash
cd ozzy-api
npm install
npm run dev
```

The server starts on `http://localhost:5000`. It handles authentication, proxies
scan requests to MetaDefender, runs the Agatha engine in-process via koffi FFI,
and manages MongoDB data.

### 4. Start the Python AI Backend

```bash
cd ozzy-ai
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

**Start the API:**

```bash
uvicorn src.main:app --host 0.0.0.0 --port 7860 --reload
```

The FastAPI server starts on `http://localhost:7860`.

### 5. Start the React Frontend

```bash
cd ozzy-app
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` with Vite's dev server.

### 6. Open the app

Navigate to `http://localhost:5173`. Register an account, then start scanning files or chatting with Ozzy.

## How It Works

1. **User uploads a file** → React sends it to the Express server
2. **If Agatha is enabled**, Express runs the native engine in-process (ONNX ML inference) with the per-file-type preferences chosen in Settings
3. **If multiscanning is enabled**, Express also proxies to MetaDefender Cloud (30+ AV engines)
4. **Frontend shows progress** overlay during scanning
5. **Results are displayed** — engine verdicts (Agatha + MetaDefender), threat score, file metadata
6. **User opens the chat** and asks about the results
7. **Chat request goes to FastAPI** with full scan context attached
8. **RAG pipeline retrieves** relevant documentation from Qdrant (hybrid search + reranking)
9. **GPT-5.4 nano generates** a context-aware response combining docs + scan data
10. **All history is persisted** in MongoDB for future reference

## Agatha Detection Engine

The Agatha engine is a Rust-compiled shared library (`andertonengine.dll` / `libandertonengine.so`) that classifies files using ONNX machine-learning models. It is loaded directly into the `ozzy-api` process via [koffi](https://koffi.dev/) (zero-compilation FFI bindings) — there is no separate engine host. JSON-in/JSON-out C functions used:

- `sdk_initialize()` — Load models and initialize the engine
- `getWorkflowInfo(&json_output)` — Returns the per-rule settings schema (one feature group per file-type family) that the Settings panel renders from
- `process(json_task, &json_output)` — UIF scan entry point; honours the per-file-type `preferences` (layer toggles + thresholds) and returns a verdict
- `sdk_deinitialize()` — Cleanup

The engine binding lives in `ozzy-api/engine/index.js`. Per-file-type configuration is sent on every scan as a flat dotted-key `preferences` map (e.g. `{ "pe": true, "pe.ml_enabled": true, "pe.threshold": 80, "image.deepscan_enabled": false }`).

**Supported file types:** PE (EXE/DLL), ELF, Mach-O, PDF, OOXML (DOCX/XLSX), Images

**Verdicts:** Clean (0) or Infected (1) with malicious/benign probability scores

## API Reference

### Express Server Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account (username, password) |
| POST | `/auth/login` | No | Login → JWT token |
| POST | `/scan-file` | Yes | Upload file → MetaDefender data_id |
| GET | `/scan/:hash` | Yes | Poll scan status by data_id |
| GET | `/scan-url-direct?encodedUrl=` | Yes | Scan a URL directly |
| GET | `/sandbox/:sha1` | Yes | Fetch sandbox analysis |
| POST | `/agatha-scan` | Yes | Upload file → Agatha engine verdict |
| GET | `/agatha-config` | Yes | Get engine availability & config |
| GET | `/chat-history` | Yes | Get user's chat history |
| POST | `/chat-history` | Yes | Save chat session |
| DELETE | `/chat-history` | Yes | Clear all chat history |
| GET | `/scan-history` | Yes | Get user's scan history |
| POST | `/scan-history` | Yes | Save scan record |
| DELETE | `/scan-history` | Yes | Clear all scan history |

### Agatha Engine Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scan` | Scan file by path → verdict + probabilities |
| POST | `/scan/batch` | Batch scan multiple files |
| GET | `/config` | Engine availability & supported file types |
| GET | `/health` | Health check |

### FastAPI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ask` | Send chat with scan context → AI response |
| POST | `/ask/stream` | Streaming SSE chat response |
| GET | `/metrics` | Performance metrics |
| GET | `/metrics/prometheus` | Prometheus-format metrics |
| GET | `/health` | Health check |

## Development

### Frontend Dev Server
```bash
cd ozzy-app && npm run dev
```
Hot-reloads on file changes. Proxy configuration in `vite.config.js`.

### Express Server (with hot reload)
```bash
cd ozzy-api && npm run dev
```
Uses nodemon for automatic restarts.

### Agatha Engine Server (with hot reload)
```bash
cd agatha && npm run dev
```
Uses nodemon. Requires engine artifacts in `package/`.

### FastAPI (with hot reload)
```bash
cd ozzy-ai && uvicorn src.main:app --reload --port 7860
```

### Linting
```bash
cd ozzy-app && npm run lint
```

### Production Build
```bash
cd ozzy-app && npm run build
```
Outputs to `ozzy-app/dist/`. The `public/_redirects` file is included for Netlify SPA deployment.

## License

This project is licensed under the MIT License.

## Acknowledgments

- [OPSWAT MetaDefender](https://www.opswat.com/products/metadefender) for the multi-scanning platform
- [Agatha Engine](https://github.com/AlinTulbure/agatha-engine) for the ML-based malware detection engine
- [OpenAI](https://platform.openai.com/) for the generative AI model
- [koffi](https://koffi.dev/) for zero-compilation Node.js FFI bindings
- [Qdrant](https://qdrant.tech/) for vector search
- [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) for hybrid embeddings
