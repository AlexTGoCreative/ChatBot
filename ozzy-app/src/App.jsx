import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import ChatBot from "./components/ChatBot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import LoadingOverlay from "./components/LoadingOverlay/LoadingOverlay";
import ScanResults from "./components/ScanResults/ScanResults";
import Navbar from "./components/Navbar/Navbar";
import Settings, { DEFAULT_AGATHA_SETTINGS } from "./components/Settings/Settings";
import LogsModal from "./components/LogsModal/LogsModal";
import { useFileScan } from "./hooks/useFileScan";
import Auth from "./components/Auth/Auth";

const AGATHA_STORAGE_KEY = 'agatha_settings';
const MULTISCANNING_STORAGE_KEY = 'multiscanning_enabled';

// Normalise a persisted `preferences` value to the per-mode shape
// `{ detection, deflection }`. Older builds stored a single FLAT dotted-key map
// (top-level keys like `pe`/`pdf`/`image`); those were captured under the
// detection profile, so we wrap them as detection and leave deflection unset
// (null → use the deflection engine's defaults). null/undefined → both null.
function migratePreferences(prefs) {
  if (!prefs || typeof prefs !== 'object') {
    return { detection: null, deflection: null };
  }
  // Already per-mode: keys are exactly/among detection|deflection.
  if ('detection' in prefs || 'deflection' in prefs) {
    return { detection: prefs.detection ?? null, deflection: prefs.deflection ?? null };
  }
  // Flat legacy map → treat as the detection profile's saved prefs.
  return { detection: prefs, deflection: null };
}

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('file');
  const [agathaSettings, setAgathaSettings] = useState(() => {
    const saved = localStorage.getItem(AGATHA_STORAGE_KEY);
    // Merge with defaults so settings persisted before new keys (e.g.
    // per-file-type preferences) were introduced still get sensible values.
    if (!saved) return DEFAULT_AGATHA_SETTINGS;
    const parsed = { ...DEFAULT_AGATHA_SETTINGS, ...JSON.parse(saved) };
    parsed.preferences = migratePreferences(parsed.preferences);
    return parsed;
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
  const engineLogs = agathaResult?.engine_logs || UrlData?.agatha?.engine_logs || '';

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
        AgathaData: agathaResult,
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
      />

      {showResults ? (
        <ScanResults
          scanData={data}
          urlData={UrlData}
          agathaResult={agathaResult}
          agathaMode={agathaSettings?.mode || 'detection'}
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
