import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

import { SWRConfig } from 'swr';
import axios from 'axios';

const MD_API_KEY = import.meta.env.VITE_METADEFENDER_API_KEY;

const fetcher = (url) =>
  axios.get(url, {
    headers: {
      apikey: MD_API_KEY,
    },
  }).then((res) => res.data);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 5000,
      }}
    >
      <App />
    </SWRConfig>
  </StrictMode>
);
