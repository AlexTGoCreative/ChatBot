# RAG Architecture — Current Implementation

> **Last updated:** 2026-06-03
> **Version:** 2.0 (post-P0 improvements)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            POST /ask                                         │
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
│ 4. CONTEXT ASSEMBLY                                                          │
│    • Scan context: file info, scan results, sandbox, URL data                │
│    • Doc context: concatenated reranked chunks (with isolation markers)       │
│    • Abstention path: if no docs pass threshold AND no scan context           │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5. PROMPT CONSTRUCTION (OpenAI Responses API format)                         │
│    • developer message: system instructions + doc context + scan context     │
│    • user/assistant messages: full chat history as structured turns           │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 6. GENERATION (OpenAI GPT-5.4-nano)                                          │
│    • client.responses.create(model, input)                                   │
│    • Returns response.output_text                                            │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 7. RESPONSE                                                                  │
│    • Return {"answer": output_text}                                          │
│    • Record per-stage timing metrics                                         │
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
│ │ Full chat history in chronological order        │ │
│ │ (each message as its own turn)                  │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Role mapping:**
| Chatbot role | OpenAI role | Purpose |
|-------------|-------------|---------|
| (system) | `developer` | Highest priority instructions; cannot be overridden by user |
| `user` | `user` | End-user messages |
| `bot` | `assistant` | Model's previous responses |

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

---

## Startup Sequence

```
1. Load .env file (python-dotenv)
2. Initialize OpenAI client (reads OPENAI_API_KEY)
3. Load cross-encoder reranker model (~2-5s, downloads on first run)
4. Load embedding model: all-mpnet-base-v2 (~3-10s)
5. Load/create ChromaDB vector store from hash_lookup.txt
6. Start FastAPI server on port 7860
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
| No token budgeting | Long chat histories may exceed context window | P0 Step 4: Token-aware truncation |
| No response caching | Repeated queries hit the LLM every time | P0 Step 5: Redis L1 cache |
| No streaming | Client waits for full response | P0 Step 6: SSE streaming |
| Single document source | Knowledge limited to hash-lookup docs | Expand corpus |
| Character-based chunking | Chunks may split mid-sentence | P1: Token-aware structure splitting |
| No hybrid retrieval | Pure dense search; misses keyword matches | P1: BM25 + dense fusion |
| No query rewriting | Follow-up questions lack context | P1: Query rewriter |
| Symmetric embeddings | Same model for query and doc encoding | P1: Asymmetric embeddings |
| No evaluation | No way to measure quality regressions | P0 Step 8: RAGAS golden set |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-03 | 2.0 | Replaced no-op reranker with cross-encoder; switched from Gemini to OpenAI GPT-5.4-nano; added relevance threshold + abstention; module-level singletons; per-stage metrics; context isolation markers; structured message roles |
| — | 1.0 | Initial prototype: Gemini 2.0 Flash, ChromaDB MMR, no-op sort, string concat prompt |
