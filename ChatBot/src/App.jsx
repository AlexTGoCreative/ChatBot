import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import ChatBot from "./components/ChatBot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import LoadingOverlay from "./components/LoadingOverlay/LoadingOverlay";
import ScanResults from "./components/ScanResults/ScanResults";
import { useFileScan } from "./hooks/useFileScan";
import Auth from "./components/Auth/Auth";

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  const { 
    data, 
    sandboxData, 
    UrlData, 
    isLoading, 
    error, 
    isComplete,
    scanStatus,
    scanProgress,
    scanMessage,
    retryScan,
    scanType
  } = useFileScan(scanSource, user);


  const handleFormSubmit = (input, type) => {
    if (type === 'hash') {
      setScanSource({ type: "hash", value: input.trim() });
    } else if (typeof input === 'string') {
      setScanSource({ type: "url", value: input.trim() });
    } else if (input instanceof File) {
      setScanSource({ type: "file", value: input });
    }
  };

  const handleFileDrop = (files) => {
    const file = files[0];
    setScanSource({ type: "file", value: file });
  };

  const handleAuthSuccess = (authData) => {
    setIsAuthenticated(true);
    setUser(authData.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setScanSource({ type: null, value: null });
    setShowResults(false);
  };

  const handleNewScan = () => {
    setScanSource({ type: null, value: null });
    setShowResults(false);
  };

  const handleChatbotToggle = (isOpen) => {
    setShowChatbot(isOpen);
  };

  // Show results when scan is complete
  useEffect(() => {
    if (isComplete && (data || UrlData)) {
      setShowResults(true);
    }
  }, [isComplete, data, UrlData]);
  
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Show scan results if available
  if (showResults) {
    return (
      <ScanResults
        scanData={data}
        sandboxData={sandboxData}
        urlData={UrlData}
        scanType={scanType}
        onNewScan={handleNewScan}
        user={user}
      />
    );
  }

  return (
    <div className="app-container">
      <nav className="app-nav">
        <div className="user-info">
          Welcome, {user.username}
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </nav>
      <div className="app-content">
        <UrlForm 
          onSubmit={handleFormSubmit} 
          isScanning={scanStatus === 'scanning'} 
          isChatbotOpen={showChatbot}
        />
        <ChatBot 
          Data={{ 
            ScanningData: data, 
            SandboxData: sandboxData, 
            UrlScanData: UrlData 
          }}
          user={user}
          onToggle={handleChatbotToggle}
        />
        <FileDropZone 
          onFileDrop={handleFileDrop} 
          isScanning={scanStatus === 'scanning'}
          isChatbotOpen={showChatbot}
        />
      </div>
      
      <LoadingOverlay
        isVisible={scanStatus !== 'idle'}
        status={scanStatus}
        progress={scanProgress}
        message={scanMessage}
        onRetry={retryScan}
        scanType={scanType}
      />
    </div>
  );
}