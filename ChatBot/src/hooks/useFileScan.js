import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import axios from 'axios';

const MD_API_KEY = import.meta.env.VITE_METADEFENDER_API_KEY;

export function useFileScan(scanSource) {
  const { cache } = useSWRConfig();
  const [data, setData] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hash, setHash] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [sandboxData, setSandboxData] = useState(null);
  const [UrlData, setUrlData] = useState(null);

  const url = hash ? `http://localhost:5000/scan/${hash}` : null;
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
    {
      refreshInterval: data?.scan_results?.progress_percentage === 100 ? 0 : 5000,
      revalidateOnFocus: false,
      onSuccess: async (newData) => {
        console.log('New Data:', newData);
        setData(newData);

        if (newData?.scan_results?.progress_percentage === 100) {
          console.log("STOP GET");
          setIsComplete(true);

          // Dacă există sandbox_id, cerem sandbox info
          const sandboxId = newData?.last_sandbox_id?.[0]?.sandbox_id;
          const sha1 = newData?.file_info?.sha1;

          //console.log(sandboxId)
          //console.log(sha1)

          if (sandboxId && sha1) {
            try {
              const sandboxRes = await axios.get(`http://localhost:5000/sandbox/${sha1}`);
              setSandboxData(sandboxRes.data);
              console.log("Sandbox Data:", sandboxRes.data);
            } catch (err) {
              console.error("Error fetching sandbox data:", err);
            }
          }
        }
      },
      onError: (err) => {
        console.error('SWR Error:', err);
      },
    }
  );

  const startScan = async () => {
    try {

      setData(null);
      setUrlData(null);
      setHash(null);
      setIsComplete(false);
      setScanError(null);
      setSandboxData(null);

      let response;

      if (scanSource.type === 'file') {
        const formData = new FormData();
        formData.append('file', scanSource.value);
        response = await axios.post('http://localhost:5000/scan-file', formData, {
          headers: { apikey: MD_API_KEY },
        });
        const { hash } = response.data;
        setHash(hash);
      } else if (scanSource.type === 'url') {
        const encodedUrl = encodeURIComponent(scanSource.value);
        const response = await axios.get(`http://localhost:5000/scan-url-direct?encodedUrl=${encodedUrl}`, {
          headers: { apikey: MD_API_KEY },
        });
        setUrlData(response.data);
        setIsComplete(true);
      }
    } catch (err) {
      console.error('Error during file/url scan:', err);
      setScanError(err);
    }
  };

  useEffect(() => {
    if (scanSource && scanSource.value) {
      startScan();
    }
  }, [scanSource]);

  return {
    data,
    sandboxData,
    UrlData,
    error: error || scanError,
    isLoading: !data && !error && !scanError,
    isComplete,
    mutate,
  };
}
