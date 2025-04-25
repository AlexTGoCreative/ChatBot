import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from "swr";
import axios from "axios";

const MD_API_KEY = import.meta.env.VITE_METADEFENDER_API_KEY;

const fetcher = (url) =>
  axios
    .get(url, {
      headers: {
        apikey: MD_API_KEY,
      },
    })
    .then((res) => res.data);

export function useFileScan(hash) {
  const { cache } = useSWRConfig();
  const [data, setData] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  const url = hash ? `http://localhost:5000/scan/${hash}` : null;

  const cachedData = url ? cache.get(url) : null;
  const isCachedComplete = cachedData?.sanitized?.progress_percentage === 100;

  useEffect(() => {
    if (isCachedComplete) {
      setData(cachedData);
      setIsComplete(true);
    }
  }, [url, isCachedComplete, cachedData]);

  const { error, mutate } = useSWR(
    !isCachedComplete ? url : null, 
    fetcher,
    {
      refreshInterval: data?.sanitized?.progress_percentage === 100 ? 0 : 5000,
      revalidateOnFocus: false,
      onSuccess: (newData) => {
        setData(newData);
        if (newData?.sanitized?.progress_percentage === 100) {
          setIsComplete(true);
        }
      },
    }
  );

  console.log(data);

  return {
    data,
    error,
    isLoading: !data && !error,
    isComplete,
    mutate,
  };
}
