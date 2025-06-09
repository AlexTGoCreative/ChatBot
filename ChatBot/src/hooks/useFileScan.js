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

export function useFileScan(scanSource, user) {
  const { cache } = useSWRConfig();
  const [data, setData] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hash, setHash] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [sandboxData, setSandboxData] = useState(null);
  const [UrlData, setUrlData] = useState(null);

  // Clear all data when user changes (to solve cross scan problem)
  useEffect(() => {
    setData(null);
    setIsComplete(false);
    setHash(null);
    setScanError(null);
    setSandboxData(null);
    setUrlData(null);
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

        if (newData?.scan_results?.progress_percentage === 100) {
          console.log("STOP GET");
          setIsComplete(true);

          const sandboxId = newData?.last_sandbox_id?.[0]?.sandbox_id;
          const sha1 = newData?.file_info?.sha1;

          if (sandboxId && sha1) {
            try {
              const sandboxRes = await axios.get(`${API_URL}/sandbox/${sha1}`, {
                headers: {
                  apikey: MD_API_KEY,
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                }
              });
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
    if (!user) return;

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
        response = await axios.post(`${API_URL}/scan-file`, formData, {
          headers: { 
            apikey: MD_API_KEY,
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          },
        });
        const { hash } = response.data;
        setHash(hash);
      } else if (scanSource.type === 'url') {
        const encodedUrl = encodeURIComponent(scanSource.value);
        const response = await axios.get(`${API_URL}/scan-url-direct?encodedUrl=${encodedUrl}`, {
          headers: { 
            apikey: MD_API_KEY,
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          },
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
    if (scanSource && scanSource.value && user) {
      startScan();
    }
  }, [scanSource, user]);

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