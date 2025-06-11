import { useState, useEffect } from "react";
import UrlForm from "./components/Form/UrlForm";
import Chatbot from "./components/Chatbot/ChatBot";
import FileDropZone from "./components/Form/FileDropZone";
import { useFileScan } from "./hooks/useFileScan";
import Auth from "./components/Auth/Auth";

export default function App() {
  const [scanSource, setScanSource] = useState({ type: null, value: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const { data, sandboxData, UrlData, isLoading, error, isComplete } = useFileScan(scanSource, user);


  const handleFormSubmit = (input) => {
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
  };
  
  if (!isAuthenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
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
        <UrlForm onSubmit={handleFormSubmit} />
        <Chatbot 
          Data={{ 
            ScanningData: data, 
            SandboxData: sandboxData, 
            UrlScanData: UrlData 
          }}
          user={user}
        />
        <FileDropZone onFileDrop={handleFileDrop} />
      </div>
    </div>
  );
}