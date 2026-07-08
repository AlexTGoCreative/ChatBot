// Helpers for reading the argus file-engine diagnostics log (the `engine_logs`
// string returned per scan). The engine logs each deepscan-scored hyperlink as:
//   [INFO |ANDERTON] Hyperlink result [URL='https://x' Verdict='1' MaliciousProb='0.8234']
// so both the Logs panel and the results-page "Extracted Links" section parse
// the same lines instead of relying on a separate API field.

const field = (line, key) => {
  const m = line.match(new RegExp(`${key}='([^']*)'`));
  return m ? m[1] : null;
};

// Numeric hyperlink verdict (string) -> label. 0 Clean · 1 Malicious · 2 Unknown · -1 Failed.
export const URL_VERDICT = { '0': 'Clean', '1': 'Malicious', '2': 'Unknown', '-1': 'Failed' };

/**
 * Extract every scored hyperlink from an engine log string.
 * @returns {Array<{url:string|null, verdict:string|null, malicious:string|null}>}
 */
export function parseHyperlinks(logs) {
  if (!logs || typeof logs !== 'string') return [];
  const out = [];
  for (const line of logs.split(/\r?\n/)) {
    if (line.includes('Hyperlink result')) {
      out.push({
        url: field(line, 'URL'),
        verdict: field(line, 'Verdict'),
        malicious: field(line, 'MaliciousProb'),
      });
    }
  }
  return out;
}
