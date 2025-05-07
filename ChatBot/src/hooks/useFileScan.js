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

  const url = hash ? `http://localhost:5000/scan/${hash}` : null;
  // const hashTest = "bzI1MDUwN2VsOHhsOV9mNm5MQWdXYzdLZTFP_mdaas";
  // const url = `http://localhost:5000/scan/${hashTest}`;
  const cachedData = url ? cache.get(url) : null;
  const isCachedComplete = cachedData?.scan_results?.progress_percentage === 100 || false;

  useEffect(() => {
    if (isCachedComplete) {
      //console.log('Cached Data:', cachedData);
      setData(cachedData);
      setIsComplete(true);
    }
  }, [url, isCachedComplete, cachedData]);

  const { error, mutate } = useSWR(
    !isCachedComplete && url ? url : null,
    {
      refreshInterval: data?.scan_results?.progress_percentage === 100 ? 0 : 5000,
      revalidateOnFocus: false,
      onSuccess: (newData) => {
        console.log('New Data:', newData);
        setData(newData);
        if (newData?.scan_results?.progress_percentage === 100) {
          console.log("STOP GET");
          setIsComplete(true);
        }
      },
      onError: (err) => {
        console.error('SWR Error:', err);
      },
    }
  );  

  const startScan = async () => {
    try {
      let response;
      if (scanSource.type === 'file') {
        const formData = new FormData();
        formData.append('file', scanSource.value);
        response = await axios.post('http://localhost:5000/scan-file', formData, {
          headers: { apikey: MD_API_KEY },
        });
      } else if (scanSource.type === 'url') {
        response = await axios.post('http://localhost:5000/scan-url', { url: scanSource.value }, {
          headers: { apikey: MD_API_KEY },
        });
      }
      const { hash } = response.data;
      console.log('Response Data:', response.data);
      console.log('Hash:', hash);
      setHash(hash);
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
    error: error || scanError,
    isLoading: !data && !error && !scanError,
    isComplete,
    mutate,
  };
}