# Athena — AI-Powered Cybersecurity Scanner & Assistant

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)

## Quick start (Docker)

The entire stack — frontend, both backends, and their databases — runs with one command:

```bash
cp .env.docker.example .env   # then set OPENAI_API_KEY
docker compose up --build
```

Then open **http://localhost:8080**. See **[DOCKER.md](DOCKER.md)** for details.

## Overview

**Athena** is a full-stack cybersecurity scanning and analysis platform that combines OPSWAT MetaDefender Cloud multiscanning with an in-house **Argus Detection AI** engine (ONNX ML-based malware classification, for both **files** and **URLs**) and OpenAI's GPT-5.4 nano model. Users can upload files or submit URLs to get multi-engine malware verdicts, and then ask an AI assistant context-aware questions about the results — including the ARGUS verdict — powered by a Retrieval-Augmented Generation (RAG) pipeline built on MetaDefender documentation.

> **Engines available:** MetaDefender Cloud multiscanning (toggleable) and the in-process ARGUS AI engines (file classifier + URL/hyperlink classifier). The MetaDefender sandbox and hash-lookup tabs are disabled in this build.

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
│ • Argus engine (in-proc)│  │ • BGE-M3 Embeddings                   │
│ • File upload (multer)   │  │ • RAG pipeline with re-ranking        │
│ • MongoDB (users, hist.) │  │ • Streaming SSE responses             │
└──────────┬───────────────┘  └───────────────────────────────────────┘
           │
     ┌─────┴──────────────┐
     ▼                    ▼
┌──────────────────┐  ┌────────────────────────────────────────────┐
│ MetaDefender     │  │  Native engines (in-process)               │
│ Cloud API        │  │                                            │
│ (30+ AV engines, │  │  • argus.dll / .so  — Argus file classifier│
│  URL reputation) │  │  • aegisengine.dll / .so — Aegis URL cls.  │
└──────────────────┘  │  • loaded once via koffi · ONNX inference   │
                      │  • UIF `process` + `getWorkflowInfo` FFI   │
                      │  • per-file-type layers + thresholds       │
                      │  • scans run on a bounded worker pool (8)  │
                      └────────────────────────────────────────────┘
```

## Features

### Threat Scanning
- **Argus Detection AI (files)** — In-house ONNX ML engine that classifies files as Clean / Infected / Inconclusive, with per-file-type layer toggles and thresholds (enabled by default)
- **Argus URL/Hyperlink AI** — In-house ONNX ML engine that classifies URLs as Clean / Suspicious / Malicious from the URL string alone (static, no fetch)
- **Multiscanning** — Upload any file for analysis by 30+ anti-malware engines via MetaDefender (toggleable)
- **URL reputation** — Submit URLs for MetaDefender reputation + WHOIS, shown alongside the Argus URL verdict
- **Detailed results** — Per-engine verdicts, threat scores, file metadata, and detection classifications, with JSON export
- **Concurrency** — The native engines are loaded once and serve up to 8 concurrent scans (configurable)

### AI Assistant (Athena)
- **Context-aware chat** — Ask questions about scan results; the bot receives the full scan context, including the **ARGUS file and URL verdicts**, and explains them
- **Persistent conversation** — The same chat carries across the main page and the scan-results page
- **RAG pipeline** — Retrieves relevant MetaDefender documentation to ground AI responses
- **Multi-language** — Detects query language and responds in kind
- **Chat history** — Conversations (with their scan context) persist per-user and can be revisited

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
│   │   │   ├── Auth/            # Login & Register forms
│   │   │   ├── ChatBot/         # AI chat interface (mounted once at App level)
│   │   │   ├── Form/            # File upload & URL input
│   │   │   ├── LoadingOverlay/  # Scan progress indicator
│   │   │   ├── ScanResults/     # Results display & export
│   │   │   └── Settings/        # Schema-driven Argus engine settings
│   │   ├── hooks/
│   │   │   └── useFileScan.js   # Scan lifecycle (Argus + MetaDefender)
│   │   └── utils/
│   │       └── api.js           # HTTP client for Express server
│   ├── package.json
│   ├── Dockerfile               # nginx build serving SPA + reverse proxy
│   ├── nginx.conf               # /api→ozzy-api, /ask→ozzy-ai
│   └── vite.config.js           # Dev proxy: /scan→:5000, /ask→:7860
│
├── ozzy-api/                # Express API server (+ native Argus engines)
│   ├── index.js             # Routes (auth, scan proxy, argus file/URL, history)
│   ├── engine/
│   │   ├── index.js         # File engine koffi binding (load-once + scanAsync)
│   │   └── package/         # File engine artifacts (git-ignored)
│   ├── url-engine/
│   │   ├── index.js         # URL/hyperlink engine koffi binding (scanAsync)
│   │   └── package/         # URL engine artifacts (git-ignored)
│   ├── lib/
│   │   └── semaphore.js     # Counting semaphore bounding concurrent scans
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── models/
│   │   ├── User.js          # User schema (username, hashed password)
│   │   ├── ChatHistory.js   # Chat messages + scan context (incl. argusData)
│   │   └── ScanHistory.js   # File/URL scan records
│   ├── Dockerfile
│   └── package.json
│
├── ozzy-ai/                 # RAG AI backend
│   ├── src/
│   │   ├── main.py          # FastAPI app — /ask, /ask/stream, /health
│   │   ├── retrieval.py     # Qdrant hybrid search (dense + sparse, RRF)
│   │   ├── generation.py    # OpenAI Responses API + streaming
│   │   ├── reranking.py     # BGE-reranker-v2-m3 cross-encoder
│   │   ├── schemas.py       # /ask payload (incl. file + URL argus verdicts)
│   │   └── context.py       # System prompt + scan context assembly
│   ├── scripts/
│   │   ├── scrape_docs.py   # Playwright scraper for MD docs
│   │   └── ingest.py        # Chunk & index into Qdrant
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml       # Full stack: app, api, ai, mongo, qdrant, redis
├── DOCKER.md                # Docker run guide
└── README.md
```

> The native engines now run **in-process** inside `ozzy-api` via koffi — there
> is no separate Argus HTTP host (the old `argus/` server on `:3002` is gone).

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **MongoDB** instance (local or Atlas)
- **OPSWAT MetaDefender Cloud API key** — [Get one here](https://metadefender.opswat.com/)
- **OpenAI API key** — [Get one here](https://platform.openai.com/api-keys)
- **Argus engine build** — Compiled `andertonengine.dll` + ONNX model (from `argus-engine` repo)

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
# Optional — override the native engine package directories.
# Default to ozzy-api/engine/package and ozzy-api/url-engine/package.
# ARGUS_PACKAGE_DIR=./engine/package
# ARGUS_URL_PACKAGE_DIR=./url-engine/package
# Optional — max concurrent scans per engine (default 8 each).
# ARGUS_SCAN_THREADS=8
# ARGUS_URL_THREADS=8
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

### 2. Provide the native Argus engine package

The engine DLL and ONNX models are loaded in-process by `ozzy-api`. Place the
built engine package under `ozzy-api/engine/package/`:

```bash
# From the argus-engine repo after building:
cp -r target/package/* ../ChatBot/ozzy-api/engine/package/
```

The directory should contain `andertonengine.dll` (or `libandertonengine.so`),
the `onnxruntime-*` libraries, the `model_*.onnx` files, `falsedetection.txt`,
and the `reputation-engine/` folder. If the DLL is missing, `ozzy-api` still
starts and Argus scans report "engine unavailable".

### 3. Start the Express Server

```bash
cd ozzy-api
npm install
npm run dev
```

The server starts on `http://localhost:5000`. It handles authentication, proxies
scan requests to MetaDefender, runs the Argus engine in-process via koffi FFI,
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

Navigate to `http://localhost:5173`. Register an account, then start scanning files or chatting with Athena.

## How It Works

1. **User uploads a file** → React sends it to the Express server
2. **If Argus is enabled**, Express runs the native engine in-process (ONNX ML inference) with the per-file-type preferences chosen in Settings
3. **If multiscanning is enabled**, Express also proxies to MetaDefender Cloud (30+ AV engines)
4. **Frontend shows progress** overlay during scanning
5. **Results are displayed** — engine verdicts (Argus + MetaDefender), threat score, file metadata
6. **User opens the chat** and asks about the results
7. **Chat request goes to FastAPI** with full scan context attached — including the ARGUS file and URL verdicts — so Athena can explain them
8. **RAG pipeline retrieves** relevant documentation from Qdrant (hybrid search + reranking)
9. **GPT-5.4 nano generates** a context-aware response combining docs + scan data
10. **All history is persisted** in MongoDB for future reference

## Argus Detection Engine

The Argus engine is a Rust-compiled shared library (`andertonengine.dll` / `libandertonengine.so`) that classifies files using ONNX machine-learning models. It is loaded directly into the `ozzy-api` process via [koffi](https://koffi.dev/) (zero-compilation FFI bindings) — there is no separate engine host. JSON-in/JSON-out C functions used:

- `sdk_initialize()` — Load models and initialize the engine
- `getWorkflowInfo(&json_output)` — Returns the per-rule settings schema (one feature group per file-type family) that the Settings panel renders from
- `process(json_task, &json_output)` — UIF scan entry point; honours the per-file-type `preferences` (layer toggles + thresholds) and returns a verdict
- `sdk_deinitialize()` — Cleanup

The engine binding lives in `ozzy-api/engine/index.js`. Per-file-type configuration is sent on every scan as a flat dotted-key `preferences` map (e.g. `{ "pe": true, "pe.ml_enabled": true, "pe.threshold": 80, "image.deepscan_enabled": false }`).

**Supported file types:** PE (EXE/DLL), ELF, Mach-O, PDF, OOXML (DOCX/XLSX), Images

**Verdicts:** Clean (0), Infected (1), Inconclusive (2), or Unsupported (3), with malicious/benign probability scores

### Concurrency model

Each native engine is initialized **once** at startup (`sdk_initialize` loads the model into memory — multiple GB for the file engine). Scans are then dispatched through koffi's **asynchronous** interface, which runs each `process()` call on a koffi worker thread instead of blocking the Node event loop. A counting semaphore (`ozzy-api/lib/semaphore.js`) caps in-flight scans at `ARGUS_SCAN_THREADS` (default **8**) so the engine is loaded once and served by a bounded pool of concurrent scans — the counting-semaphore generalisation of a single-scan mutex. The URL engine uses the same pattern (`ARGUS_URL_THREADS`).

### Argus URL / Hyperlink engine

A second native engine — Aegis (`aegisengine.dll` / `libaegisengine.so`, bound in `ozzy-api/url-engine/index.js`) — classifies a URL from its string alone — 107 URL features through an ONNX model, no network fetch. Verdicts: Clean (0), Malicious (1), Suspicious (2), Unavailable (-1). Its verdict is shown next to the MetaDefender URL reputation and is passed into the chat context so Athena can explain it.

> **Hyperlink features in the file pipeline (future work):** the file feature
> extractor can also count/extract hyperlinks from PDF/OOXML, and the URL model
> exists, but URL scores are **not** appended to the file feature vector or used
> in file-model training in this build. The URL model is used only to score links
> submitted through the UI. This is documented as future work, not a live feature.

## API Reference

### Express Server Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account (username, password) |
| POST | `/auth/login` | No | Login → JWT token |
| POST | `/scan-file` | Yes | Upload file → MetaDefender data_id |
| GET | `/scan/:hash` | Yes | Poll scan status by data_id |
| GET | `/scan-url-direct?encodedUrl=` | Yes | MetaDefender URL reputation lookup |
| POST | `/argus-scan` | Yes | Upload file → Argus file-engine verdict |
| GET | `/argus-url-scan?url=` | Yes | Argus URL/hyperlink engine verdict |
| GET | `/argus-workflow-info` | Yes | Per-file-type settings schema (drives Settings panel) |
| GET | `/argus-config` | Yes | Engine availability & supported file types |
| GET | `/chat-history` | Yes | Get user's chat history |
| POST | `/chat-history` | Yes | Save chat session (messages + scan context) |
| PUT | `/chat-history/:chatId` | Yes | Update an existing chat session |
| DELETE | `/chat-history` | Yes | Clear all chat history |
| GET | `/scan-history` | Yes | Get user's scan history |
| POST | `/scan-history` | Yes | Save scan record |
| DELETE | `/scan-history` | Yes | Clear all scan history |

> The native Argus **file** and **URL** engines run in-process inside this same
> Express server (via koffi) — there is no separate Argus HTTP host anymore.

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
Uses nodemon for automatic restarts. The native Argus file and URL engines are
loaded in-process here — no separate engine server to start.

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
- [Argus Engine](https://github.com/AlinTulbure/argus-engine) for the ML-based malware detection engine
- [OpenAI](https://platform.openai.com/) for the generative AI model
- [koffi](https://koffi.dev/) for zero-compilation Node.js FFI bindings
- [Qdrant](https://qdrant.tech/) for vector search
- [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) for hybrid embeddings
