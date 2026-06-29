# Running Athena with Docker

The entire stack — frontend, both backends, and their databases — runs from a
single command. The native **Agatha file engine** and **Agatha URL engine** run
inside the API container as Linux `.so` builds (the Windows `.dll` files are kept
alongside them so the same checkout still works when run natively on Windows).

## Prerequisites

- Docker Desktop (Linux-container mode, the default).
- An **OpenAI API key** (for the chat assistant).
- Internet access on first run (pulls base images, installs deps, and downloads
  the BGE-M3 embedding/reranker models for the AI service).

## 1. Configure secrets

```bash
cp .env.docker.example .env
# then edit .env and set OPENAI_API_KEY (and JWT_SECRET / METADEFENDER_API_KEY)
```

## 2. Launch everything

```bash
docker compose up --build
```

First boot takes a while: it builds three images and the AI service downloads
~4 GB of models into a persistent volume (`hf_cache`). Subsequent starts are fast.

Open the app at: **http://localhost:8080**

| Service   | URL / Port              | Purpose                                   |
|-----------|-------------------------|-------------------------------------------|
| ozzy-app  | http://localhost:8080   | React UI + reverse proxy (open this)      |
| ozzy-api  | :5000 (proxied at /api) | Auth, scans, history, Agatha engines      |
| ozzy-ai   | :7860 (proxied at /ask) | RAG chat assistant                        |
| mongo     | internal                | Users, scan & chat history                |
| qdrant    | internal :6333          | RAG vector store                          |
| redis     | internal :6379          | RAG response cache                        |

The browser only ever talks to `:8080`; nginx proxies `/api/*` → ozzy-api and
`/ask` → ozzy-ai, so there are no CORS issues or hard-coded ports in the bundle.

## 3. (Optional) Populate the RAG knowledge base

The chat assistant works without this — it answers from scan context and general
knowledge — but for grounded answers about OPSWAT docs, run the ingestion once:

```bash
# Scrape OPSWAT docs into data/, then index them into Qdrant:
docker compose exec ozzy-ai python scripts/scrape_docs.py
docker compose exec ozzy-ai python scripts/ingest.py
```

(See `ozzy-ai/scripts/`. Ingestion needs internet access to scrape the docs and
will use the embedding model already loaded by the service.)

## Native engines

The API image contains, under `ozzy-api/engine/package/` and
`ozzy-api/url-engine/package/`:

- `libandertonengine.so` / `libhyperlinkengine.so` — the Linux engine builds
- `libonnxruntime.so` — ONNX Runtime the engines load at runtime
- the `.onnx` models
- the original Windows `.dll` files (ignored on Linux, used when run on Windows)

These `.so` files are produced from the `agatha-engine` and `agatha-url` sources
with `mocli build release` (see "Rebuilding the engines" below).

Each engine is **loaded once** when the API container starts (the file engine's
ONNX model is several GB resident). Scans then run on a bounded pool of worker
threads via koffi's async interface — up to `AGATHA_SCAN_THREADS` file scans and
`AGATHA_URL_THREADS` URL scans concurrently (default **8** each, set in `.env`).
This keeps the model loaded once while still serving multiple scans in parallel.

## Common commands

```bash
docker compose up --build         # build + start
docker compose up -d              # start detached
docker compose logs -f ozzy-api   # follow one service's logs
docker compose down               # stop (keeps volumes/data)
docker compose down -v            # stop and wipe all data/models
```

## Rebuilding the engines (Linux .so)

The `.so` binaries are built on Linux from the Rust sources. On Windows, use WSL:

```bash
# URL engine
cd agatha-url && cargo build --release --lib      # → target/release/libhyperlinkengine.so

# File engine — built with diagnostics + the hyperlink SDK so it emits the
# per-scan diagnostics log the UI "Logs" panel shows (feature vector, scan
# layers, inference verdict) and scores embedded PDF/OOXML deepscan URLs.
# Linux ONNX Runtime must sit at the marker path first (see gotchas below).
cd agatha-engine && \
  RUSTFLAGS="-Awarnings" cargo xtask build-package --profile release \
    --reputation --extractor-diagnostics --hyperlink-sdk
# → target/release/libandertonengine.so  (+ target/package/ staged artifacts)
```

Then copy into `ozzy-api/engine/package/`:

- `libandertonengine.so` (the freshly built file engine)
- `libhyperlinkengine.so` + `model_hyperlink.onnx` — the file engine loads the
  hyperlink SDK *from its own package dir* to score deepscan URLs in-process, so
  these must sit beside `libandertonengine.so` (not only in `url-engine/package/`).

and copy `libhyperlinkengine.so` + a Linux `libonnxruntime.so` into
`ozzy-api/url-engine/package/` for the standalone URL engine.

### Engine diagnostics log

The file engine writes a structured diagnostics log to
`<ANDERTON_LOG_DIR>/engine.log` (default `engine/package/anderton/`). `ozzy-api`
pins `ANDERTON_LOG_DIR` and sets `ANDERTON_LOG_LEVEL=debug` before init so the
feature vector + extractor lines are emitted, then returns the slice produced by
each scan as `engine_logs` in the `/agatha-scan` response. Override the level
with the `ANDERTON_LOG_LEVEL` env var (`info` for a quieter log).

`ozzy-api` also sets `ANDERTON_LOG_FEATURE_VECTOR=1`, which makes the engine dump
the **full named ML feature vector** (every `feature=value`, ~600+ entries) per
scan — that is what fills the feature-vector section of the Logs panel. Set it to
`0` to log only the `First10`/`Last10` preview instead.

### Build notes / gotchas

- **ONNX Runtime:** `mocli build release` fetches the Linux ONNX Runtime from a
  private S3 bucket (needs AWS creds). Without creds, drop a public build at the
  marker path the build checks before staging — e.g.
  `agatha-engine/ext/onnxruntime-avx2/onnxruntime_package/lib/libonnxruntime.so`
  (use ONNX Runtime **1.18.1**, x64, from the official GitHub releases) — and the
  build skips the download.
- **Toolchain ICE:** some bleeding-edge `rustc` builds (seen with 1.94.0/1.95.0
  on Linux) crash (ICE) in the *diagnostic renderer* while displaying warnings
  from the engine's Unix-only code. Build with `--message-format=short` to use a
  different emitter that doesn't trip the bug:
  `cargo build --release --lib --message-format=short`.
- The `.so` must be built on **glibc** (Debian/Ubuntu), not musl/Alpine — the
  API image uses `node:20-bookworm-slim` for this reason.
