import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import ChatBot from "./components/ChatBot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import LoadingOverlay from "./components/LoadingOverlay/LoadingOverlay";
import ScanResults from "./components/ScanResults/ScanResults";
import Navbar from "./components/Navbar/Navbar";
import Settings, { DEFAULT_ARGUS_SETTINGS } from "./components/Settings/Settings";
import LogsModal from "./components/LogsModal/LogsModal";
import { useFileScan } from "./hooks/useFileScan";
import Auth from "./components/Auth/Auth";

const ARGUS_STORAGE_KEY = 'argus_settings';
const MULTISCANNING_STORAGE_KEY = 'multiscanning_enabled';
const THEME_STORAGE_KEY = 'ozzy_theme';

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('file');
  const [argusSettings, setArgusSettings] = useState(() => {
    const saved = localStorage.getItem(ARGUS_STORAGE_KEY)
      ?? localStorage.getItem('agatha_settings');
    if (!saved) return DEFAULT_ARGUS_SETTINGS;
    const parsed = JSON.parse(saved);
    // Strip legacy mode/per-mode prefs shape from older builds.
    const { mode, preferences, ...rest } = parsed;
    const flatPrefs = preferences?.detection ?? preferences?.deflection ?? preferences ?? null;
    return { ...DEFAULT_ARGUS_SETTINGS, ...rest, preferences: flatPrefs };
  });
  const [multiscanningEnabled, setMultiscanningEnabled] = useState(() => {
    const saved = localStorage.getItem(MULTISCANNING_STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'light');

  const {
    data,
    UrlData,
    argusResult,
    isLoading,
    error,
    isComplete,
    scanStatus,
    scanProgress,
    scanMessage,
    retryScan,
    dismissScan,
    scanType
  } = useFileScan(scanSource, user, multiscanningEnabled, argusSettings);


  const handleFormSubmit = (input, type) => {
    if (typeof input === 'string') {
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
    setShowLogs(false);
  };

  const handleNewScan = () => {
    setScanSource({ type: null, value: null });
    setShowResults(false);
    setShowLogs(false);
  };

  // Engine diagnostics for the current scan. The file engine returns them as
  // `engine_logs`; the URL engine nests its result under `urlData.agatha`.
  const engineLogs = argusResult?.engine_logs || UrlData?.agatha?.engine_logs || '';

  const handleChatbotToggle = (isOpen) => {
    setShowChatbot(isOpen);
  };

  // Persist all settings (multiscanning + Argus) from the Settings panel.
  const handleSaveSettings = ({ multiscanningEnabled: nextMulti, argusSettings: nextArgus }) => {
    setMultiscanningEnabled(nextMulti);
    localStorage.setItem(MULTISCANNING_STORAGE_KEY, JSON.stringify(nextMulti));
    setArgusSettings(nextArgus);
    localStorage.setItem(ARGUS_STORAGE_KEY, JSON.stringify(nextArgus));
  };

  // Show results when scan is complete
  useEffect(() => {
    if (isComplete && (data || UrlData || argusResult)) {
      setShowResults(true);
    }
  }, [isComplete, data, UrlData, argusResult]);

  // Apply the light/dark theme to the document root so index.css's
  // `[data-theme="dark"]` token overrides take effect app-wide.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  const settingsModal = showSettings && (
    <Settings
      argusSettings={argusSettings}
      multiscanningEnabled={multiscanningEnabled}
      onSave={handleSaveSettings}
      onClose={() => setShowSettings(false)}
    />
  );

  const logsModal = showLogs && (
    <LogsModal logs={engineLogs} onClose={() => setShowLogs(false)} />
  );

  // A single ChatBot instance lives at the app-container level so its
  // conversation, loaded scan data, and history selection survive navigation
  // between the main page and the scan-results page. Rendering a separate
  // ChatBot inside each view (as before) unmounted it on every page switch,
  // wiping the in-progress conversation.
  const chatbot = (
    <ChatBot
      Data={{
        ScanningData: data,
        UrlScanData: UrlData,
        ArgusData: argusResult,
      }}
      user={user}
      onToggle={handleChatbotToggle}
    />
  );

  return (
    <div className="app-container">
      <Navbar
        username={user?.username}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLogs={showResults ? () => setShowLogs(true) : undefined}
        onLogout={handleLogout}
        scanMode={showResults ? scanType : activeTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {showResults ? (
        <ScanResults
          scanData={data}
          urlData={UrlData}
          argusResult={argusResult}
          multiscanningEnabled={multiscanningEnabled}
          scanFile={scanSource?.type === 'file' ? scanSource.value : null}
          scanType={scanType}
          onNewScan={handleNewScan}
          user={user}
        />
      ) : (
        <>
          <div className="app-content">
            <UrlForm
              onSubmit={handleFormSubmit}
              isScanning={scanStatus === 'scanning'}
              isChatbotOpen={showChatbot}
              activeTab={activeTab}
              onTabChange={setActiveTab}
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
        </>
      )}

      {chatbot}
      {settingsModal}
      {logsModal}
    </div>
  );
}
