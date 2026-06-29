import { useState } from "react";
import "./UrlForm.css";

const UrlForm = ({ onSubmit, isScanning, isChatbotOpen, activeTab, onTabChange }) => {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isScanning) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && !isScanning) {
      onSubmit(file);
      e.target.value = null; 
    }
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case 'file':
        return 'Scan a file';
      case 'url':
        return 'Scan a URL';
      default:
        return 'File or URL';
    }
  };

  return (
    <>
      <div className={`form-wrapper ${isChatbotOpen ? 'chatbot-open' : ''}`}>
        <div className="hero">
          <p className="hero-sub">
            Scan a file or URL for malware. Files and URLs are checked against
            20+ reputation sources through MetaDefender and the Agatha AI detection
            engine for a fast, independent second opinion.{' '}
            <span className="learn-more-link" onClick={() => setShowModal(true)}>
              Learn more...
            </span>
          </p>
        </div>
        
        <div className="scan-panel">
          <div className="scan-buttons-container">
            <div className="scan-buttons-group">
              <button
                className={`scan-tab-button ${activeTab === 'file' ? 'active' : ''}`}
                onClick={() => onTabChange('file')}
              >
                <span className="icon-placeholder">📄</span>
                Scan a file
              </button>
              <button
                className={`scan-tab-button ${activeTab === 'url' ? 'active' : ''}`}
                onClick={() => onTabChange('url')}
              >
                <span className="icon-placeholder">🔗</span>
                Scan a URL
              </button>
            </div>
          </div>

          <div className="scan-card">
            <div className="scan-card-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
                <path d="M9 13l2 2 4-4" />
              </svg>
            </div>
            <div className="trust-no-file-text">
              {activeTab === 'file' && 'Trust No File'}
              {activeTab === 'url' && 'Trust No URL'}
            </div>

            <form className={`url-form ${isScanning ? 'scanning' : ''}`} onSubmit={handleSubmit}>
              <div className="input-container">
                <input
                  type="text"
                  placeholder={getPlaceholder()}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="url-input"
                  disabled={isScanning}
                />
                <label className="file-label">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="file-input"
                    accept="*/*"
                    disabled={isScanning}
                  />
                  <span className="material-symbols-rounded attach-icon">attach_file</span>
                </label>
              </div>
              <button type="submit" className="submit-button" disabled={isScanning}>
                {isScanning ? 'Processing...' : 'Process'}
              </button>
            </form>
            <p className="scan-hint">
              {activeTab === 'file' && 'Drag & drop a file anywhere, or browse with the clip.'}
              {activeTab === 'url' && 'Paste a full URL including http:// or https://.'}
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h2>About Agatha</h2>
            <div className="modal-body">
              <p>
                Agatha is a malware analysis workspace that combines two detection layers and
                an assistant to help you make sense of the results.
              </p>
              <p>
                <strong>MetaDefender multiscanning</strong> checks every file against 20+ commercial
                anti-malware engines in a single pass, so a threat missed by one vendor is caught
                by another. URLs are checked separately through MetaDefender's URL reputation,
                which aggregates multiple online reputation sources.
              </p>
              <p>
                <strong>Agatha</strong> is an AI detection engine that uses ONNX machine-learning
                models to give an independent, signature-free second opinion. For files it classifies
                PE, ELF, Mach-O, PDF, OOXML, and image types as clean or infected (configurable per
                file type in Agatha settings); for URLs a dedicated Hyperlink model scores the address
                as clean, suspicious, or malicious — both running alongside MetaDefender for an
                at-a-glance comparison.
              </p>
              <p>
                The built-in <strong>Agatha assistant</strong> can answer questions about a scan,
                explain verdicts, and walk you through what a detection means.
              </p>
              <p className="modal-footer-text">
                <strong>Your scan and chat history are saved to your account.</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UrlForm;