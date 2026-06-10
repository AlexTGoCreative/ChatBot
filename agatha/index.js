require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const koffi = require('koffi');

const app = express();
app.use(cors());
app.use(express.json());

// === Engine Configuration ===
const PORT = process.env.PORT || 3002;
const PACKAGE_DIR = process.env.PACKAGE_DIR || path.join(__dirname, 'package');

// Determine library name based on platform
const LIB_NAME = process.platform === 'win32'
  ? path.join(PACKAGE_DIR, 'andertonengine.dll')
  : path.join(PACKAGE_DIR, 'libandertonengine.so');

// === Load Native Engine ===
let lib = null;
let sdkInitialize = null;
let sdkDeinitialize = null;
let sdkScan = null;
let sdkScanBatch = null;
let engineReady = false;

try {
  // Add package dir to DLL search path (Windows)
  if (process.platform === 'win32') {
    process.env.PATH = PACKAGE_DIR + ';' + process.env.PATH;
  }

  lib = koffi.load(LIB_NAME);

  sdkInitialize = lib.func('int sdk_initialize()');
  sdkDeinitialize = lib.func('int sdk_deinitialize()');
  sdkScan = lib.func('int sdk_scan(const char *input, _Out_ const char **output)');
  sdkScanBatch = lib.func('int sdk_scan_batch(const char *input, _Out_ const char **output)');

  const initResult = sdkInitialize();
  if (initResult === 0) {
    engineReady = true;
    console.log(`[agatha] Engine initialized successfully from: ${PACKAGE_DIR}`);
  } else {
    console.error(`[agatha] Engine initialization failed with code: ${initResult}`);
  }
} catch (err) {
  console.error(`[agatha] Failed to load native library: ${err.message}`);
  console.error(`[agatha] Looked for: ${LIB_NAME}`);
  console.error(`[agatha] The server will start but scans will return "engine unavailable".`);
}

// Cleanup on exit
process.on('exit', () => {
  if (sdkDeinitialize && engineReady) {
    try { sdkDeinitialize(); } catch (e) { /* ignore */ }
  }
});
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// === Scan Endpoint ===
app.post('/scan', (req, res) => {
  if (!engineReady) {
    return res.status(503).json({
      verdict: -1,
      threat_name: '',
      malicious_probability: 0,
      benign_probability: 0,
      error: 'Engine not initialized',
    });
  }

  const { file_path, settings } = req.body;

  if (!file_path) {
    return res.status(400).json({ error: 'file_path is required' });
  }

  try {
    const scanInput = JSON.stringify({
      file_path: file_path,
      file_type: null,
      data_id: null,
      sha256: null,
    });

    const outputPtr = [null];
    const ret = sdkScan(scanInput, outputPtr);

    if (ret !== 0) {
      return res.json({
        verdict: -1,
        threat_name: '',
        malicious_probability: 0,
        benign_probability: 0,
        error: 'Scan failed',
      });
    }

    const result = JSON.parse(outputPtr[0]);

    res.json({
      verdict: result.verdict,
      threat_name: result.threat_name || '',
      malicious_probability: result.malicious_probability || 0,
      benign_probability: result.benign_probability || 0,
    });
  } catch (err) {
    console.error('[agatha] Scan error:', err.message);
    res.status(500).json({
      verdict: -1,
      threat_name: '',
      malicious_probability: 0,
      benign_probability: 0,
      error: err.message,
    });
  }
});

// === Batch Scan Endpoint ===
app.post('/scan/batch', (req, res) => {
  if (!engineReady) {
    return res.status(503).json({ error: 'Engine not initialized', results: [] });
  }

  const { files } = req.body;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'files array is required' });
  }

  try {
    const batchInput = JSON.stringify({
      files: files.map(f => ({
        file_path: f.file_path,
        file_type: f.file_type || null,
        data_id: f.data_id || null,
        sha256: f.sha256 || null,
      })),
    });

    const outputPtr = [null];
    const ret = sdkScanBatch(batchInput, outputPtr);

    if (ret !== 0) {
      return res.json({ error: 'Batch scan failed', results: [] });
    }

    const result = JSON.parse(outputPtr[0]);
    res.json(result);
  } catch (err) {
    console.error('[agatha] Batch scan error:', err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

// === Config/Health Endpoints ===
app.get('/config', (req, res) => {
  res.json({
    available: engineReady,
    mode: 'detection',
    verdicts: ['Clean', 'Infected'],
    supported_file_types: ['PE', 'ELF', 'Mach-O', 'PDF', 'OOXML', 'Image'],
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: engineReady ? 'ok' : 'degraded',
    engine_loaded: engineReady,
    package_dir: PACKAGE_DIR,
  });
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`[agatha] HTTP server running on port ${PORT}`);
  console.log(`[agatha] Engine status: ${engineReady ? 'READY' : 'NOT AVAILABLE'}`);
});
