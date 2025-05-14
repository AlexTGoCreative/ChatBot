import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import Chatbot from "./components/Chatbot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import { useFileScan } from "./hooks/useFileScan";

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });

  const { data, sandboxData, isLoading, error, isComplete } = useFileScan(scanSource);

  const handleUrlSubmit = (url) => {
    setScanSource({ type: "url", value: url.trim() });
  };

  const handleFileDrop = (files) => {
    const file = files[0];
    setScanSource({ type: "file", value: file });
  };
  
  return (
    <div>
      <UrlForm onSubmit={handleUrlSubmit} />
      <Chatbot Data={{ ScanningData: data, SandboxData: sandboxData }} />
      <FileDropZone onFileDrop={handleFileDrop} />
    </div>
  );
}
