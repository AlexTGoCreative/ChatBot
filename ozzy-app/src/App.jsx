import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import ChatBot from "./components/ChatBot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import LoadingOverlay from "./components/LoadingOverlay/LoadingOverlay";
import ScanResults from "./components/ScanResults/ScanResults";
import AgathaSettings, { DEFAULT_SETTINGS } from "./components/AgathaSettings/AgathaSettings";
import { useFileScan } from "./hooks/useFileScan";
import Auth from "./components/Auth/Auth";

const AGATHA_STORAGE_KEY = 'agatha_settings';
const MULTISCANNING_STORAGE_KEY = 'multiscanning_enabled';

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showAgathaSettings, setShowAgathaSettings] = useState(false);
  const [agathaSettings, setAgathaSettings] = useState(() => {
    const saved = localStorage.getItem(AGATHA_STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [multiscanningEnabled, setMultiscanningEnabled] = useState(() => {
    const saved = localStorage.getItem(MULTISCANNING_STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const { 
    data, 
    sandboxData, 
    UrlData,
    agathaResult,
    isLoading, 
    error, 
    isComplete,
    scanStatus,
    scanProgress,
    scanMessage,
    retryScan,
    scanType
  } = useFileScan(scanSource, user, multiscanningEnabled);


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

  const handleAgathaSettingsChange = (newSettings) => {
    setAgathaSettings(newSettings);
    localStorage.setItem(AGATHA_STORAGE_KEY, JSON.stringify(newSettings));
  };

  const handleMultiscanningToggle = () => {
    const newValue = !multiscanningEnabled;
    setMultiscanningEnabled(newValue);
    localStorage.setItem(MULTISCANNING_STORAGE_KEY, JSON.stringify(newValue));
  };

  // Show results when scan is complete
  useEffect(() => {
    if (isComplete && (data || UrlData || agathaResult)) {
      setShowResults(true);
    }
  }, [isComplete, data, UrlData, agathaResult]);
  
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Show scan results if available
  if (showResults) {
    return (
      <>
        <ScanResults
          scanData={data}
          sandboxData={sandboxData}
          urlData={UrlData}
          agathaResult={agathaResult}
          multiscanningEnabled={multiscanningEnabled}
          scanFile={scanSource?.type === 'file' ? scanSource.value : null}
          scanType={scanType}
          onNewScan={handleNewScan}
          user={user}
        />
        {showAgathaSettings && (
          <AgathaSettings
            settings={agathaSettings}
            onSettingsChange={handleAgathaSettingsChange}
            onClose={() => setShowAgathaSettings(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      <nav className="app-nav">
        <div className="user-info">
          Welcome, {user.username}
        </div>
        <div className="nav-actions">
          <button 
            onClick={handleMultiscanningToggle} 
            className={`agatha-nav-btn ${multiscanningEnabled ? 'active' : ''}`}
            title="Toggle MetaDefender Multiscanning"
          >
            🛡️ {multiscanningEnabled ? 'Multiscanning On' : 'Multiscanning Off'}
          </button>
          <button 
            onClick={() => setShowAgathaSettings(true)} 
            className="agatha-nav-btn"
            title="Agatha Engine Settings"
          >
            🧠 Agatha Settings
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
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

      {showAgathaSettings && (
        <AgathaSettings
          settings={agathaSettings}
          onSettingsChange={handleAgathaSettingsChange}
          onClose={() => setShowAgathaSettings(false)}
        />
      )}
    </div>
  );
}