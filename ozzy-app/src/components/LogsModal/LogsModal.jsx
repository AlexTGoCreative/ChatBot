import { useMemo, useState } from 'react';
import './LogsModal.css';
import { parseHyperlinks, URL_VERDICT } from '../../utils/engineLogs';

// Engine diagnostics viewer.
//
// The agatha file engine (built with the extractor_diagnostics + hyperlink_sdk
// features) emits a structured log per scan — feature-extraction timings, the ML
// feature vector, the effective scan layers, the inference verdict, and the
// scored deepscan URLs (PDF/OOXML hyperlinks). ozzy-api captures the slice of
// engine.log produced by the scan and returns it as `engine_logs`; this panel
// shows it raw, with a few parsed highlights pulled to the top.

// Pull the human-interesting facts out of the raw log so the user doesn't have
// to read every line. Everything here is best-effort string matching against the
// engine's `[LEVEL |MODULE] message [k='v' …]` format — a miss just omits that
// highlight, it never throws.
function parseHighlights(raw) {
  const lines = raw.split(/\r?\n/);
  const field = (line, key) => {
    const m = line.match(new RegExp(`${key}='([^']*)'`));
    return m ? m[1] : null;
  };

  const highlights = { verdict: null, fileType: null, featureCount: null, urls: [] };

  for (const line of lines) {
    if (line.includes('Inference completed')) {
      highlights.verdict = {
        verdict: field(line, 'Verdict'),
        benign: field(line, 'BenignProb'),
        malicious: field(line, 'MaliciousProb'),
      };
    }
    if (line.includes('Running inference')) {
      highlights.fileType = highlights.fileType || field(line, 'FileType');
      highlights.featureCount = highlights.featureCount || field(line, 'FeatureCount');
    }
    if (line.includes('Effective scan layers')) {
      highlights.fileType = highlights.fileType || field(line, 'FileType');
    }
  }
  // Scored deepscan URLs share the parser used by the results-page links section.
  highlights.urls = parseHyperlinks(raw);
  return highlights;
}

// Tag each raw line with its log level so we can colour it.
function levelOf(line) {
  if (/\bERROR\b|\bCRITICAL\b/.test(line)) return 'error';
  if (/\bWARNING\b/.test(line)) return 'warn';
  if (/\bDEBUG\b|\bTRACE\b/.test(line)) return 'debug';
  if (/\bINFO\b/.test(line)) return 'info';
  return 'plain';
}

export default function LogsModal({ logs, onClose }) {
  const [copied, setCopied] = useState(false);
  const raw = (logs || '').trim();
  const hasLogs = raw.length > 0;

  const highlights = useMemo(() => (hasLogs ? parseHighlights(raw) : null), [raw, hasLogs]);
  const lines = useMemo(() => (hasLogs ? raw.split(/\r?\n/) : []), [raw, hasLogs]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="logs-overlay" onClick={onClose}>
      <div className="logs-popup" onClick={(e) => e.stopPropagation()}>
        <div className="logs-header">
          <div className="logs-header-left">
            <span className="logs-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </span>
            <h2>Engine Logs</h2>
          </div>
          <div className="logs-header-actions">
            {hasLogs && (
              <button type="button" className="logs-copy-btn" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <button type="button" className="logs-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="logs-body">
          {!hasLogs ? (
            <div className="logs-empty">
              <p>No engine diagnostics for this scan.</p>
              <span>
                The agatha file engine produces diagnostics (feature vector, scan layers,
                verdict, scored deepscan URLs) only when it ran for this scan. Enable the
                Agatha engine in Settings and scan a supported file (PE, ELF, PDF, OOXML,
                image) to see logs here.
              </span>
            </div>
          ) : (
            <>
              {highlights && (
                <div className="logs-highlights">
                  {highlights.verdict && (
                    <div className="logs-chip">
                      <span className="logs-chip-k">Verdict</span>
                      <span className={`logs-chip-v verdict-${(highlights.verdict.verdict || '').toLowerCase()}`}>
                        {highlights.verdict.verdict || '—'}
                      </span>
                    </div>
                  )}
                  {highlights.fileType && (
                    <div className="logs-chip">
                      <span className="logs-chip-k">File type</span>
                      <span className="logs-chip-v">{highlights.fileType}</span>
                    </div>
                  )}
                  {highlights.featureCount && (
                    <div className="logs-chip">
                      <span className="logs-chip-k">Feature vector</span>
                      <span className="logs-chip-v">{highlights.featureCount} features</span>
                    </div>
                  )}
                </div>
              )}

              {highlights && highlights.urls.length > 0 && (
                <div className="logs-urls">
                  <div className="logs-urls-title">Scored URLs (deepscan)</div>
                  {highlights.urls.map((u, i) => (
                    <div className="logs-url-row" key={i}>
                      <span className={`logs-url-badge verdict-${(URL_VERDICT[u.verdict] || '').toLowerCase()}`}>
                        {URL_VERDICT[u.verdict] || u.verdict || '?'}
                      </span>
                      <span className="logs-url-text" title={u.url || ''}>{u.url || '(no url)'}</span>
                      {u.malicious != null && (
                        <span className="logs-url-prob">mal {u.malicious}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="logs-raw">
                {lines.map((line, i) => (
                  <div key={i} className={`logs-line lvl-${levelOf(line)}`}>{line || ' '}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
