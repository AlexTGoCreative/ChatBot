# Ozzy — AI-Powered Cybersecurity Scanner & Assistant

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

## Overview

**Ozzy** is a full-stack cybersecurity scanning and analysis platform that combines OPSWAT MetaDefender Cloud with OpenAI's GPT-5.4 nano model. Users can upload files, submit URLs/IPs, or look up hashes to get multi-engine malware verdicts, sandbox analysis, and then ask an AI assistant context-aware questions about the results — powered by a Retrieval-Augmented Generation (RAG) pipeline built on MetaDefender documentation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend (Vite)                       │
│              File Upload · URL/Hash Input · Chat UI                 │
└───────────────┬──────────────────────────────────┬──────────────────┘
                │                                  │
         Scan requests                       Chat messages
         (proxy /scan)                       (proxy /ask)
                │                                  │
                ▼                                  ▼
┌───────────────────────────┐     ┌───────────────────────────────────┐
│   Express Server (:5000)  │     │    FastAPI Server (:7860)         │
│                           │     │                                   │
│ • JWT Authentication      │     │ • OpenAI GPT-5.4 nano LLM          │
│ • MetaDefender API Proxy  │     │ • ChromaDB Vector Store            │
│ • File upload (multer)    │     │ • HuggingFace Embeddings           │
│ • MongoDB (users, history)│     │ • RAG pipeline with re-ranking     │
│ • Chat & Scan History     │     │ • Language detection                │
└───────────────┬───────────┘     └───────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│  MetaDefender Cloud API   │
│  (30+ AV engines,         │
│   sandbox, URL scan)      │
└───────────────────────────┘
```

## Features

### Threat Scanning
- **File scanning** — Upload any file for analysis by 30+ anti-malware engines via MetaDefender
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
| AI Backend | Python 3.9+, FastAPI, Uvicorn, LangChain, ChromaDB |
| LLM | OpenAI GPT-5.4 nano |
| Embeddings | sentence-transformers/all-mpnet-base-v2 |
| Database | MongoDB (users, chat/scan history) |
| Vector Store | ChromaDB (MetaDefender docs) |
| External API | OPSWAT MetaDefender Cloud v4 |

## Project Structure

```
├── ozzy-app/                # React frontend (in this repo)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/        # Login & Register forms
│   │   │   ├── ChatBot/     # AI chat interface
│   │   │   ├── Form/        # File upload & URL input
│   │   │   ├── LoadingOverlay/  # Scan progress indicator
│   │   │   └── ScanResults/ # Results display & export
│   │   ├── hooks/
│   │   │   └── useFileScan.js   # Scan lifecycle management (SWR polling)
│   │   └── utils/
│   │       └── api.js       # HTTP client for Express server
│   ├── package.json
│   └── vite.config.js       # Dev proxy: /scan→:5000, /ask→:7860
│
├── ozzy-api/                # Git submodule → github.com/AlexTGoCreative/ozzy-api
│   ├── index.js             # API routes (auth, scan proxy, history)
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── models/
│   │   ├── User.js          # User schema (username, hashed password)
│   │   ├── ChatHistory.js   # Chat messages + scan context
│   │   └── ScanHistory.js   # File/URL scan records
│   └── package.json
│
├── ozzy-ai/                 # Git submodule → github.com/AlexTGoCreative/ozzy-ai
│   ├── chat_api.py          # FastAPI app — RAG + OpenAI chat endpoint
│   ├── evaluate_rag.py      # Golden set evaluation script
│   ├── evaluation/          # Golden set Q/A pairs
│   ├── scraping_hash_lookup.py  # Scraper for MetaDefender docs
│   ├── requirements.txt
│   ├── Dockerfile
│   └── scraped_html/        # Cached documentation text
│
├── docker-compose.yml       # Orchestrates all services + Redis + MongoDB
└── README.md
```

## Prerequisites

- **Node.js** 16+ and npm
- **Python** 3.9+
- **MongoDB** instance (local or Atlas)
- **OPSWAT MetaDefender Cloud API key** — [Get one here](https://metadefender.opswat.com/)
- **OpenAI API key** — [Get one here](https://platform.openai.com/api-keys)

## Environment Variables

Create a `.env` file in each of the three service directories:

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
```

### `ozzy-ai/.env`
```env
OPENAI_API_KEY=your_openai_api_key
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

### 2. Start the Express Server

```bash
cd ozzy-api
npm install
npm run dev
```

The server starts on `http://localhost:5000`. It handles authentication, proxies scan requests to MetaDefender, and manages MongoDB data.

### 3. Start the Python AI Backend

```bash
cd ozzy-ai
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

**(Optional) Scrape fresh MetaDefender documentation for the vector store:**

```bash
python scraping_hash_lookup.py
```

> This uses Playwright to fetch the latest MetaDefender API docs. The scraped content is already included in `scraped_html/`, so this step is only needed to update the knowledge base.

**Start the API:**

```bash
uvicorn chat_api:app --host 0.0.0.0 --port 7860 --reload
```

The FastAPI server starts on `http://localhost:7860`. On first startup it builds/loads the ChromaDB vector store from the scraped documentation.

### 4. Start the React Frontend

```bash
cd ozzy-app
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` with Vite's dev server. API requests are proxied automatically:
- `/scan/*` → Express server (`:5000`)
- `/ask` → FastAPI server (`:7860`)

### 5. Open the app

Navigate to `http://localhost:5173`. Register an account, then start scanning files or chatting with Ozzy.

## Docker

**Full stack (recommended):**

```bash
docker compose up --build
```

This starts all services (frontend, API gateway, RAG AI, Redis, MongoDB).

**AI Backend only:**

```bash
cd ozzy-ai
docker build -t ozzy-ai .
docker run -p 7860:7860 -e OPENAI_API_KEY=your_key ozzy-ai
```

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
| GET | `/chat-history` | Yes | Get user's chat history |
| POST | `/chat-history` | Yes | Save chat session |
| DELETE | `/chat-history` | Yes | Clear all chat history |
| GET | `/scan-history` | Yes | Get user's scan history |
| POST | `/scan-history` | Yes | Save scan record |
| DELETE | `/scan-history` | Yes | Clear all scan history |

### FastAPI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ask` | Send chat with scan context → AI response |
| GET | `/metrics` | Performance metrics (request times, counts) |

#### POST `/ask` payload

```json
{
  "chatHistory": [
    { "role": "user", "text": "Is this file safe?" },
    { "role": "bot", "text": "..." }
  ],
  "scanResults": { ... },
  "fileInfo": { ... },
  "sandboxData": { ... },
  "urlData": { ... }
}
```

## How It Works

1. **User uploads a file or submits a URL** → React sends it to the Express server
2. **Express proxies to MetaDefender Cloud** → Returns a `data_id` for tracking
3. **Frontend polls scan status** via SWR (every 5 seconds) until complete
4. **Results are displayed** — per-engine verdicts, threat score, file metadata
5. **User opens the chat** and asks about the results
6. **Chat request goes to FastAPI** with full scan context attached
7. **RAG pipeline retrieves** relevant MetaDefender documentation from ChromaDB
8. **GPT-5.4 nano generates** a context-aware response combining docs + scan data
9. **All history is persisted** in MongoDB for future reference

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

### FastAPI (with hot reload)
```bash
cd ozzy-ai && uvicorn chat_api:app --reload --port 7860
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
- [OpenAI](https://platform.openai.com/) for the generative AI model
- [LangChain](https://www.langchain.com/) for the RAG framework
- [ChromaDB](https://www.trychroma.com/) for vector storage
