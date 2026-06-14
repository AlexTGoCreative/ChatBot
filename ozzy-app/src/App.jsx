import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import ChatBot from "./components/ChatBot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import LoadingOverlay from "./components/LoadingOverlay/LoadingOverlay";
import ScanResults from "./components/ScanResults/ScanResults";
import Navbar from "./components/Navbar/Navbar";
import Settings, { DEFAULT_AGATHA_SETTINGS } from "./components/Settings/Settings";
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
  const [showSettings, setShowSettings] = useState(false);
  const [agathaSettings, setAgathaSettings] = useState(() => {
    const saved = localStorage.getItem(AGATHA_STORAGE_KEY);
    // Merge with defaults so settings persisted before new keys (e.g.
    // per-file-type preferences) were introduced still get sensible values.
    return saved ? { ...DEFAULT_AGATHA_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AGATHA_SETTINGS;
  });
  const [multiscanningEnabled, setMultiscanningEnabled] = useState(() => {
    const saved = localStorage.getItem(MULTISCANNING_STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const {
    data,
    UrlData,
    agathaResult,
    isLoading,
    error,
    isComplete,
    scanStatus,
    scanProgress,
    scanMessage,
    retryScan,
    dismissScan,
    scanType
  } = useFileScan(scanSource, user, multiscanningEnabled, agathaSettings);


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
    setShowSettings(false);
  };

  const handleNewScan = () => {
    setScanSource({ type: null, value: null });
    setShowResults(false);
  };

  const handleChatbotToggle = (isOpen) => {
    setShowChatbot(isOpen);
  };

  // Persist all settings (multiscanning + Agatha) from the Settings panel.
  const handleSaveSettings = ({ multiscanningEnabled: nextMulti, agathaSettings: nextAgatha }) => {
    setMultiscanningEnabled(nextMulti);
    localStorage.setItem(MULTISCANNING_STORAGE_KEY, JSON.stringify(nextMulti));
    setAgathaSettings(nextAgatha);
    localStorage.setItem(AGATHA_STORAGE_KEY, JSON.stringify(nextAgatha));
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

  const settingsModal = showSettings && (
    <Settings
      agathaSettings={agathaSettings}
      multiscanningEnabled={multiscanningEnabled}
      onSave={handleSaveSettings}
      onClose={() => setShowSettings(false)}
    />
  );

  // Show scan results if available
  if (showResults) {
    return (
      <div className="app-container">
        <Navbar
          username={user?.username}
          onOpenSettings={() => setShowSettings(true)}
          onLogout={handleLogout}
        />
        <ScanResults
          scanData={data}
          urlData={UrlData}
          agathaResult={agathaResult}
          multiscanningEnabled={multiscanningEnabled}
          scanFile={scanSource?.type === 'file' ? scanSource.value : null}
          scanType={scanType}
          onNewScan={handleNewScan}
          user={user}
        />
        {settingsModal}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar
        username={user?.username}
        onOpenSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
      />
      <div className="app-content">
        <UrlForm
          onSubmit={handleFormSubmit}
          isScanning={scanStatus === 'scanning'}
          isChatbotOpen={showChatbot}
        />
        <ChatBot
          Data={{
            ScanningData: data,
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
        onClose={dismissScan}
        scanType={scanType}
      />

      {settingsModal}
    </div>
  );
}
