import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import Chatbot from "./components/Chatbot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import { useFileScan } from "./hooks/useFileScan";

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });

  const { data, isLoading, error, isComplete } = useFileScan(scanSource);

  const handleUrlSubmit = (url) => {
    setScanSource({ type: "url", value: url.trim() });
  };

  const handleFileDrop = (files) => {
    const file = files[0];
    setScanSource({ type: "file", value: file });
  };

  // useEffect(() => {
  //   if (scanSource.type === "url") {
  //     console.log("🔗 URL primit:", scanSource.value);
  //   } else if (scanSource.type === "file") {
  //     console.log("📄 Fișier primit:", scanSource.value);
  //   }
  // }, [scanSource]);

  return (
    <div>
      <UrlForm onSubmit={handleUrlSubmit} />
      <Chatbot fileScanData={data} />
      <FileDropZone onFileDrop={handleFileDrop} />
    </div>
  );
}
