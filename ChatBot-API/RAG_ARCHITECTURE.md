# RAG Architecture — Current Implementation

> **Last updated:** 2026-06-03
> **Version:** 2.2 (P0 complete)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     POST /ask  |  POST /ask/stream                           │
│                     (ChatPayload: history + scan context)                    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. EXTRACT QUERY                                                             │
│    • Take last user message from chat_history                                │
│    • Detect language (langdetect)                                            │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. RETRIEVAL (ChromaDB + MMR)                                                │
│    • Embed query via all-mpnet-base-v2 (768-d)                               │
│    • Maximal Marginal Relevance search: k=10, fetch_k=30, λ=0.5             │
│    • Returns 10 candidate chunks                                             │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. RERANKING (Cross-Encoder)                                                 │
│    • Model: cross-encoder/ms-marco-MiniLM-L-6-v2                             │
│    • Score every (query, doc.page_content) pair                              │
│    • Sort by score descending                                                │
│    • Filter: discard docs with score < 0.1 (RERANK_THRESHOLD)                │
│    • Keep top 5 (RERANK_TOP_K)                                               │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 4. CACHE LOOKUP (Redis L1)                                                   │
│    • Key = sha256(question + context_hash)                                   │
│    • Hit → return cached answer immediately                                  │
│    • Miss → continue to generation                                           │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5. CONTEXT ASSEMBLY                                                          │
│    • Scan context: file info, scan results, sandbox, URL data                │
│    • Doc context: concatenated reranked chunks (with isolation markers)       │
│    • Abstention path: if no docs pass threshold AND no scan context           │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 6. PROMPT CONSTRUCTION (OpenAI Responses API format)                         │
│    • developer message: system instructions + doc context + scan context     │
│    • user/assistant messages: token-budgeted history (4000 tok max)           │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 7. GENERATION (OpenAI GPT-5.4-nano)                                          │
│    • /ask: client.responses.create(model, input) → full response             │
│    • /ask/stream: stream=True → SSE deltas                                   │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 8. RESPONSE + CACHE STORE                                                    │
│    • Store in Redis (TTL: 24h normal, 30min abstentions)                     │
│    • Return {"answer": output_text} or SSE stream                            │
│    • Record Prometheus metrics + per-stage timing                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Stage Breakdown

### Stage 1: Query Extraction

| Aspect | Detail |
|--------|--------|
| Input | `ChatPayload` containing `chat_history` (list of `{role, text}`) |
| Logic | Iterate chat history in reverse, take first message with `role == "user"` |
| Language | Detected via `langdetect` library; defaults to `"en"` on failure |
| Failure | Returns HTTP 400 if no user message found |

### Stage 2: Retrieval

| Aspect | Detail |
|--------|--------|
| Vector Store | ChromaDB (SQLite-backed, persisted to `chroma_db/`) |
| Embedding Model | `sentence-transformers/all-mpnet-base-v2` (768 dimensions) |
| Search Strategy | Maximal Marginal Relevance (MMR) |
| Parameters | `k=10` results, `fetch_k=30` candidates, `lambda_mult=0.5` |
| Purpose of MMR | Balances relevance with diversity — avoids returning near-duplicate chunks |

**How MMR works in this context:**
1. Embeds the query using `all-mpnet-base-v2`
2. Fetches 30 nearest vectors from ChromaDB
3. Iteratively selects 10 documents that are both similar to the query AND dissimilar to each other
4. `lambda_mult=0.5` means equal weight on relevance vs. diversity

### Stage 3: Reranking

| Aspect | Detail |
|--------|--------|
| Model | `cross-encoder/ms-marco-MiniLM-L-6-v2` (22M params, ~50ms/10 pairs on CPU) |
| Input | 10 (query, document_text) pairs |
| Output | Relevance score per pair (unbounded float, higher = more relevant) |
| Threshold | `0.1` — documents scoring below this are discarded |
| Top-K | Max 5 documents kept after filtering |

**Why a cross-encoder instead of the original sort:**
- Bi-encoders (like the embedding model) encode query and document independently — fast but less accurate
- Cross-encoders process the query and document together as a single input — slower but significantly more precise relevance scoring
- The previous implementation sorted by `metadata.score` which was always 0 (a no-op)

**Scoring example:**
```
Query: "What does verdict code 1 mean?"
Doc A (hash lookup verdicts): score = 4.7  ✓ kept
Doc B (API authentication):   score = -2.1 ✗ filtered
Doc C (scan progress codes):  score = 0.3  ✓ kept
```

### Stage 4: Context Assembly

Two types of context are assembled independently:

#### Document Context (from RAG retrieval)
- Chunks that passed reranking are joined with double newlines
- Wrapped in isolation markers: `<<<CONTEXT_START>>>` / `<<<CONTEXT_END>>>`
- Purpose: Prevents prompt injection from document content

#### Scan Context (from client payload)
Built dynamically from available scan data:

| Source | Fields Extracted |
|--------|-----------------|
| `file_info` | display_name, file_size, file_type, SHA256, SHA1, MD5, timestamps |
| `scan_results` | overall verdict, engine count, threats detected, duration |
| `sanitized_info` | sanitization result, file path, progress |
| `process_info` | result, profile, verdicts |
| `sandbox_data` | engine, final verdict, threat level, confidence, report link |
| `url_data` | address, detected_by, per-provider assessments |

#### Abstention Path
If **both** conditions are true:
- No documents pass the reranking threshold
- No scan context was provided

→ The system adds an instruction telling the model to acknowledge the lack of documentation.

### Stage 5: Prompt Construction

Uses the **OpenAI Responses API** message format with role-based structure:

```
┌─────────────────────────────────────────────────────┐
│ Message 1: role="developer"                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ System instructions                             │ │
│ │ + Document context (with isolation markers)     │ │
│ │ + Scan context (file/URL analysis data)         │ │
│ │ + Abstention note (if applicable)               │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Message 2+: role="user" or "assistant"              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Token-budgeted chat history (most recent first) │ │
│ │ Max 4000 tokens; oldest messages dropped        │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Role mapping:**
| Chatbot role | OpenAI role | Purpose |
|-------------|-------------|---------|
| (system) | `developer` | Highest priority instructions; cannot be overridden by user |
| `user` | `user` | End-user messages |
| `bot` | `assistant` | Model's previous responses |

**Token-aware history truncation (P0 Step 4):**

Chat history is allocated a fixed token budget of **4000 tokens**. The algorithm:
1. Iterate messages from most recent → oldest
2. Count tokens per message using `tiktoken` (`o200k_base` encoding) + 4 tokens overhead per message
3. Accumulate until budget is exhausted
4. Drop remaining (oldest) messages
5. Reverse back to chronological order before appending to input

This ensures the model always sees the most recent and relevant conversation context without risking context window overflow.

### Stage 6: Generation

| Aspect | Detail |
|--------|--------|
| Provider | OpenAI |
| Model | `gpt-5.4-nano` |
| API | Responses API (`client.responses.create`) |
| Client | Module-level singleton (initialized once at startup) |
| Auth | `OPENAI_API_KEY` from `.env` via `python-dotenv` |
| Output | `response.output_text` (convenience accessor aggregating all text outputs) |

### Stage 7: Response & Metrics

Returns `{"answer": "<model output>"}` to the client.

Per-stage timing is recorded:
- `retrieval` — vector search duration
- `reranking` — cross-encoder scoring duration
- `generation` — LLM API call duration
- `total_request` — end-to-end duration

---

## Knowledge Base (Document Ingestion)

### Source
Single document: `scraped_html/hash_lookup.txt`
- Scraped from OPSWAT MetaDefender Cloud API v4 hash-lookup documentation
- Augmented with hand-written verdict code explanations (`explanations.txt`)

### Chunking

| Parameter | Value |
|-----------|-------|
| Strategy | `RecursiveCharacterTextSplitter` |
| Chunk size | 1000 characters |
| Overlap | 200 characters |
| Length function | `len` (character count) |
| Separators | `["\n\n", "\n", " ", ""]` (in priority order) |

### Embedding & Storage

| Parameter | Value |
|-----------|-------|
| Model | `sentence-transformers/all-mpnet-base-v2` |
| Dimensions | 768 |
| Vector store | ChromaDB (SQLite backend) |
| Persistence | `chroma_db/` directory |
| Rebuild trigger | Embedding model name change (checked via `meta.json`) |

---

## Configuration Reference

| Constant | Value | Description |
|----------|-------|-------------|
| `OPENAI_MODEL` | `gpt-5.4-nano` | LLM for generation |
| `RERANK_MODEL_NAME` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranker model |
| `RERANK_TOP_K` | `5` | Max docs after reranking |
| `RERANK_THRESHOLD` | `0.1` | Min score to include a doc |
| `HISTORY_TOKEN_BUDGET` | `4000` | Max tokens for chat history |
| `CONTEXT_TOKEN_BUDGET` | `6000` | Max tokens for document context |
| `ANSWER_HEADROOM` | `2000` | Reserved tokens for model response |
| `TOKEN_ENCODING` | `o200k_base` | Tiktoken encoding for GPT-5.4-nano |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection (env override) |
| `CACHE_TTL_NORMAL` | `86400` (24h) | Cache TTL for normal responses |
| `CACHE_TTL_ABSTENTION` | `1800` (30min) | Cache TTL for abstention responses |
| `CHUNK_SIZE` | `1000` | Characters per chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| MMR `k` | `10` | Docs returned from retrieval |
| MMR `fetch_k` | `30` | Candidates fetched for MMR |
| MMR `lambda_mult` | `0.5` | Relevance vs. diversity balance |

---

## API Endpoints

### POST `/ask`

**Request body:**
```json
{
  "chat_history": [
    {"role": "user", "text": "What does verdict 1 mean?"},
    {"role": "bot", "text": "Verdict 1 means..."},
    {"role": "user", "text": "Is it dangerous?"}
  ],
  "scan_results": { ... },
  "file_info": { ... },
  "sandbox_data": { ... },
  "url_data": { ... }
}
```

**Response:**
```json
{
  "answer": "Based on the MetaDefender documentation, verdict code 1..."
}
```

### POST `/ask/stream`

**Request body:** Same as `/ask`

**Response:** Server-Sent Events (SSE) stream
```
data: {"delta": "Based on"}
data: {"delta": " the MetaDefender"}
data: {"delta": " documentation..."}
data: [DONE]
```

### GET `/metrics`

**Response:**
```json
{
  "average_request_time": 1.85,
  "average_retrieval_time": 0.12,
  "average_reranking_time": 0.08,
  "average_generation_time": 1.45,
  "average_vectorstore_init_time": 3.2,
  "total_requests": 42,
  "failed_requests": 1,
  "llm_model": "gpt-5.4-nano",
  "reranker_model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
  "rerank_threshold": 0.1,
  "rerank_top_k": 5
}
```

### GET `/metrics/prometheus`

Returns Prometheus exposition format with:
- `chatbot_requests_total` (counter, labels: endpoint, status)
- `chatbot_request_duration_seconds` (histogram, labels: endpoint)
- `chatbot_retrieval_duration_seconds` (histogram)
- `chatbot_rerank_duration_seconds` (histogram)
- `chatbot_generation_duration_seconds` (histogram)
- `chatbot_cache_hits_total` (counter)
- `chatbot_cache_misses_total` (counter)

---

## Startup Sequence

```
1. Load .env file (python-dotenv)
2. Initialize OpenAI client (reads OPENAI_API_KEY)
3. Load tiktoken encoding (o200k_base) for token counting
4. Load cross-encoder reranker model (~2-5s, downloads on first run)
5. Connect to Redis (graceful degradation if unavailable)
6. Initialize Prometheus metrics collectors
7. Load embedding model: all-mpnet-base-v2 (~3-10s)
8. Load/create ChromaDB vector store from hash_lookup.txt
9. Start FastAPI server on port 7860
```

---

## Security Measures

| Measure | Implementation |
|---------|---------------|
| API key storage | `.env` file (gitignored), loaded via `python-dotenv` |
| Context isolation | `<<<CONTEXT_START>>>` / `<<<CONTEXT_END>>>` delimiters |
| Role separation | `developer` role for system instructions (highest priority in OpenAI's hierarchy) |
| Input validation | Pydantic models for request payload |
| CORS | Currently allows all origins (needs tightening for production) |

---

## Known Limitations (to be addressed in future sprints)

| Limitation | Impact | Planned Fix |
|-----------|--------|-------------|
| Single document source | Knowledge limited to hash-lookup docs | Expand corpus |
| Character-based chunking | Chunks may split mid-sentence | P1: Token-aware structure splitting |
| No hybrid retrieval | Pure dense search; misses keyword matches | P1: BM25 + dense fusion |
| No query rewriting | Follow-up questions lack context | P1: Query rewriter |
| Symmetric embeddings | Same model for query and doc encoding | P1: Asymmetric embeddings |
| CORS allows all origins | Security risk in production | Restrict to known origins |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|| 2026-06-03 | 2.2 | P0 complete: Redis L1 cache with graceful degradation; SSE streaming endpoint (`/ask/stream`); Prometheus observability (`/metrics/prometheus`); Golden set (30 Q/A pairs) + evaluation script || 2026-06-03 | 2.1 | P0 Step 4: Token-aware history truncation using tiktoken; chat history capped at 4000 tokens keeping most recent messages |
| 2026-06-03 | 2.0 | Replaced no-op reranker with cross-encoder; switched from Gemini to OpenAI GPT-5.4-nano; added relevance threshold + abstention; module-level singletons; per-stage metrics; context isolation markers; structured message roles |
| — | 1.0 | Initial prototype: Gemini 2.0 Flash, ChromaDB MMR, no-op sort, string concat prompt |
