import { useState } from "react";
import UrlForm from "./components/Form/UrlForm";
import Chatbot from "./components/Chatbot/ChatBot";
import { useFileScan } from "./hooks/useFileScan";

export default function App() {
  const [hash, setHash] = useState("");
  const { data, isLoading, error, isComplete } = useFileScan(hash);
  const handleUrlSubmit = (url) => {
    setHash(url.trim());
  };

  return (
    <div>
      <UrlForm onSubmit={handleUrlSubmit} />
      <Chatbot fileScanData={data} />
    </div>
  );
}
