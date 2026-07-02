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
            Triple A is a security analysis platform built around three engines: AGATHA for file classification, Aegis for URL classification, and Athena for explaining results — all running alongside MetaDefender for a side-by-side comparison.{' '}
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
            <div className="scan-tagline">
              Scan First. Trust Nothing.
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
            <h2>About Triple A — Agatha, Aegis & Athena</h2>
            <div className="modal-body">
              <p>
                Triple A is a security analysis platform built around three engines:
                AGATHA for file classification, Aegis for URL classification, and Athena
                for explaining results — all running alongside MetaDefender for a
                side-by-side comparison.
              </p>
              <p>
                <strong>Agatha</strong> is a multi-layer file detection engine that runs
                locally on-device. It combines deterministic signature layers (hash database,
                byte-pattern and fuzzy matching, IOC reputation) with structural parsing,
                YARA rules, and XGBoost machine-learning models — one per file family
                (PE, ELF, Mach-O, PDF, OOXML, Image). The verdict is compared side-by-side
                against MetaDefender's 21 commercial anti-malware engines.
              </p>
              <p>
                <strong>Aegis</strong> is a dedicated URL classification engine. It extracts
                over 100 lexical features from the URL itself — no page visit required — and
                runs a local XGBoost classifier to produce a clean / suspicious / malicious
                verdict. The result is shown alongside MetaDefender's URL reputation check
                (aggregated from sources such as Webroot) for direct comparison.
              </p>
              <p>
                <strong>Athena</strong> is a conversational AI assistant built on a
                Retrieval-Augmented Generation (RAG) architecture. It answers questions
                about a scan, explains what a verdict means, and walks you through the
                detection evidence — grounded in the actual scan context and documentation.
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
