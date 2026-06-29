import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import axios from 'axios';

const MD_API_KEY = import.meta.env.VITE_METADEFENDER_API_KEY;
const API_URL = import.meta.env.VITE_API2_URL;

const fetcher = url => axios.get(url, {
  headers: {
    apikey: MD_API_KEY,
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
}).then(res => res.data);

export function useFileScan(scanSource, user, multiscanningEnabled = true, agathaSettings = null) {
  const { cache } = useSWRConfig();
  const [data, setData] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hash, setHash] = useState(null);
  const [scanError, setScanError] = useState(null);
  // Sandbox feature disabled — only multiscanning + Agatha are active.
  // const [sandboxData, setSandboxData] = useState(null);
  const [UrlData, setUrlData] = useState(null);
  const [agathaResult, setAgathaResult] = useState(null);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'scanning', 'success', 'error'
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState('');

  // Clear all data when user changes (to solve cross scan problem)
  useEffect(() => {
    setData(null);
    setIsComplete(false);
    setHash(null);
    setScanError(null);
    // setSandboxData(null);
    setUrlData(null);
    setAgathaResult(null);
    setScanStatus('idle');
    setScanProgress(0);
    setScanMessage('');
    cache.clear();
  }, [user?.id, cache]);

  const url = hash ? `${API_URL}/scan/${hash}` : null;
  const cachedData = url ? cache.get(url) : null;
  const isCachedComplete = cachedData?.scan_results?.progress_percentage === 100 || false;

  useEffect(() => {
    if (isCachedComplete) {
      setData(cachedData);
      setIsComplete(true);
    }
  }, [url, isCachedComplete, cachedData]);

  const { error, mutate } = useSWR(
    !isCachedComplete && url ? url : null,
    fetcher,
    {
      refreshInterval: data?.scan_results?.progress_percentage === 100 ? 0 : 5000,
      revalidateOnFocus: false,
      onSuccess: async (newData) => {
        if (!user) return;

        console.log('New Data:', newData);
        setData(newData);
        
        // Update progress and status
        const progress = newData?.scan_results?.progress_percentage || 0;
        setScanProgress(progress);
        
        if (progress < 100) {
          setScanStatus('scanning');
          setScanMessage(`Scanning file`);
        }

        if (progress === 100) {
          console.log("STOP GET");
          setIsComplete(true);
          setScanStatus('success');
          setScanMessage('Scan completed successfully!');
          
          // Auto-hide success message after 2 seconds
          setTimeout(() => {
            setScanStatus('idle');
            setScanMessage('');
          }, 2000);

          // Sandbox feature disabled — only multiscanning + Agatha are active.
          // const sandboxId = newData?.last_sandbox_id?.[0]?.sandbox_id;
          // const sha1 = newData?.file_info?.sha1;
          //
          // if (sandboxId && sha1) {
          //   try {
          //     const sandboxRes = await axios.get(`${API_URL}/sandbox/${sha1}`, {
          //       headers: {
          //         apikey: MD_API_KEY,
          //         Authorization: `Bearer ${localStorage.getItem('token')}`
          //       }
          //     });
          //     setSandboxData(sandboxRes.data);
          //     console.log("Sandbox Data:", sandboxRes.data);
          //   } catch (err) {
          //     console.error("Error fetching sandbox data:", err);
          //   }
          // }
        }
      },
      onError: (err) => {
        console.error('SWR Error:', err);
        setScanStatus('error');
        setScanMessage('Scan failed. Please try again.');
        setScanError(err);
      },
    }
  );

  const startScan = async () => {
    if (!user) return;

    try {
      // Reset all states
      setData(null);
      setUrlData(null);
      setHash(null);
      setIsComplete(false);
      setScanError(null);
      // setSandboxData(null);
      setAgathaResult(null);
      setScanProgress(0);
      
      // Set initial scanning state
      setScanStatus('scanning');
      
      let response;

      if (scanSource.type === 'file') {
        setScanMessage('Scanning file...');

        // Run the Agatha engine scan only when the user enabled it in settings.
        const agathaEnabled = !!agathaSettings?.enabled;

        // With no scanner selected there is nothing to run — surface a clear
        // error instead of silently "completing" with an empty result page.
        if (!multiscanningEnabled && !agathaEnabled) {
          setScanStatus('error');
          setScanMessage('No scanner enabled. Turn on Multiscanning or the Agatha engine to scan a file.');
          return;
        }
        const agathaPromise = agathaEnabled
          ? (async () => {
              try {
                const agathaFormData = new FormData();
                agathaFormData.append('file', scanSource.value);
                // Operating mode: 'detection' (binary) or 'deflection' (ternary).
                // The engine echoes it back on the result so the UI can render
                // the matching verdict regime.
                const mode = agathaSettings?.mode || 'detection';
                // Per-file-type preferences chosen in Agatha settings (layer
                // toggles + thresholds) for the ACTIVE mode only. Sent as a JSON
                // string; when absent/empty the engine falls back to that mode's
                // built-in profile defaults.
                const prefs = agathaSettings?.preferences?.[mode];
                if (prefs && typeof prefs === 'object' && Object.keys(prefs).length > 0) {
                  agathaFormData.append('preferences', JSON.stringify(prefs));
                }
                agathaFormData.append('mode', mode);
                const agathaRes = await axios.post(`${API_URL}/agatha-scan`, agathaFormData, {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  },
                });
                setAgathaResult(agathaRes.data);
              } catch (agathaErr) {
                console.error('Agatha engine scan error:', agathaErr);
                setAgathaResult({
                  engine: 'Agatha',
                  verdict: -1,
                  error: 'Engine unavailable'
                });
              }
            })()
          : Promise.resolve();

        // Run MetaDefender multiscanning only if enabled
        if (multiscanningEnabled) {
          const formData = new FormData();
          formData.append('file', scanSource.value);
          response = await axios.post(`${API_URL}/scan-file`, formData, {
            headers: { 
              apikey: MD_API_KEY,
              Authorization: `Bearer ${localStorage.getItem('token')}` 
            },
          });
          const { hash } = response.data;
          setHash(hash);
        } else {
          // Wait for Agatha to complete, then mark done
          await agathaPromise;
          setIsComplete(true);
          setScanStatus('success');
          setTimeout(() => {
            setScanStatus('idle');
          }, 2000);
        }
      } else if (scanSource.type === 'url') {
        setScanMessage('Processing URL...');

        // URLs mirror the file flow: MetaDefender URL reputation (gated by
        // multiscanning) runs alongside the Agatha URL engine (gated by Agatha
        // settings) so the two verdicts can be compared. The Agatha verdict is
        // merged into the URL data object under `.agatha`.
        const agathaEnabled = !!agathaSettings?.enabled;

        if (!multiscanningEnabled && !agathaEnabled) {
          setScanStatus('error');
          setScanMessage('No scanner enabled. Turn on Multiscanning or the Agatha engine to scan a URL.');
          return;
        }

        const encodedUrl = encodeURIComponent(scanSource.value);

        // Agatha URL engine (independent ONNX verdict). Never throws — surfaces
        // a graceful "unavailable" entry so it can't break the MetaDefender flow.
        const agathaMode = agathaSettings?.mode || 'detection';
        const agathaUrlPromise = agathaEnabled
          ? axios.get(`${API_URL}/agatha-url-scan?url=${encodedUrl}&mode=${agathaMode}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            })
              .then(r => r.data)
              .catch(agathaErr => {
                console.error('Agatha URL engine scan error:', agathaErr);
                return { engine: 'Agatha URL', verdict: -1, error: 'Engine unavailable' };
              })
          : Promise.resolve(null);

        // MetaDefender URL reputation (only when multiscanning is enabled).
        const mdUrlPromise = multiscanningEnabled
          ? axios.get(`${API_URL}/scan-url-direct?encodedUrl=${encodedUrl}`, {
              headers: {
                apikey: MD_API_KEY,
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            }).then(r => r.data)
          : Promise.resolve(null);

        const [mdData, agathaData] = await Promise.all([mdUrlPromise, agathaUrlPromise]);

        // Build a single URL data object. When multiscanning is off we still
        // need an `address` so the results page and history have something to
        // key on.
        const merged = {
          ...(mdData || { address: scanSource.value }),
          agatha: agathaData || null,
        };
        setUrlData(merged);

        setIsComplete(true);
        setScanStatus('success');
        setScanMessage('URL scan completed successfully!');

        // Auto-hide success message after 2 seconds
        setTimeout(() => {
          setScanStatus('idle');
          setScanMessage('');
        }, 2000);
      }
    } catch (err) {
      console.error('Error during file/url scan:', err);
      setScanError(err);
      setScanStatus('error');
      setScanMessage('Failed to start scan. Please try again.');
    }
  };

  useEffect(() => {
    if (scanSource && scanSource.value && user) {
      startScan();
    }
  }, [scanSource, user]);

  const retryScan = () => {
    if (scanSource && scanSource.value && user) {
      startScan();
    }
  };

  // Dismiss the overlay (e.g. after an error) so the user isn't stuck behind a
  // blocking layer with no way out.
  const dismissScan = () => {
    setScanStatus('idle');
    setScanMessage('');
    setScanError(null);
  };

  return {
    data,
    // sandboxData, // Sandbox feature disabled
    UrlData,
    agathaResult,
    error: error || scanError,
    isLoading: !data && !error && !scanError,
    isComplete,
    mutate,
    scanStatus,
    scanProgress,
    scanMessage,
    retryScan,
    dismissScan,
    scanType: scanSource?.type,
  };
}