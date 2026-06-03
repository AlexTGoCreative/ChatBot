import { useState } from "react";
import "./UrlForm.css";

const UrlForm = ({ onSubmit, isScanning, isChatbotOpen }) => {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("file");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isScanning) {
      if (activeTab === 'lookup') {
        onSubmit(input.trim(), 'hash');
      } else {
        onSubmit(input.trim());
      }
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
      case 'lookup':
        return 'Enter MD5, SHA1, or SHA256 hash';
      default:
        return 'File, URL, IP address, Domain, Hash, or CVE';
    }
  };

  return (
    <>
      <div className={`form-wrapper ${isChatbotOpen ? 'chatbot-open' : ''}`}>
        <div className="description-text">
          <p>
            Upload any file, URL, IP, or hash for scanning and online malware analysis. 
            Detect ransomware with 20+ antivirus engines, inspect files with the Adaptive Sandbox, 
            and neutralize threats with Deep CDR.{' '}
            <span className="learn-more-link" onClick={() => setShowModal(true)}>
              Learn more...
            </span>
          </p>
        </div>
        
        <div className="scan-buttons-container">
          <div className="scan-buttons-group">
            <button 
              className={`scan-tab-button ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              <span className="icon-placeholder">📄</span>
              Scan a file
            </button>
            <button 
              className={`scan-tab-button ${activeTab === 'url' ? 'active' : ''}`}
              onClick={() => setActiveTab('url')}
            >
              <span className="icon-placeholder">🔗</span>
              Search a URL
            </button>
            <button 
              className={`scan-tab-button ${activeTab === 'lookup' ? 'active' : ''}`}
              onClick={() => setActiveTab('lookup')}
            >
              <span className="icon-placeholder">🔍</span>
              Lookup
            </button>
          </div>
        </div>

        <div className="trust-no-file-text">
          {activeTab === 'file' && 'Trust No File'}
          {activeTab === 'url' && 'Trust No URL'}
          {activeTab === 'lookup' && 'Trust No Hash'}
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
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h2>What is MetaDefender Community?</h2>
            <div className="modal-body">
              <p>
                MetaDefender Community is a free, online file and malware scanner built for researchers, 
                IT administrators, and security-conscious users.
              </p>
              <p>
                MetaDefender Community provides advanced threat analysis and online multiscanning using 20+ 
                anti-malware engines in a single scan, delivering results from top virus scanner technologies 
                like McAfee and Bitdefender.
              </p>
              <p>
                Unlike typical online virus scanners, MetaDefender Community includes Content Disarm and 
                Reconstruction (CDR) to remove hidden threats from documents while keeping them usable.
              </p>
              <p>
                It uses the Adaptive Sandbox to detect malware based on behavior, Proactive Data Loss 
                Prevention (DLP) to flag sensitive data, and file-based vulnerability scanning which detects 
                known risks in files, IPs, URLs, and file hashes.
              </p>
              <p>
                Perfect for anyone needing to scan files, check URLs, or verify IPs, this free threat 
                detection tool and malware analysis helps prevent zero-day attacks and weaponized file uploads.
              </p>
              <p>
                Sign up for a free account and unlock scan history, higher scanning limits, and access to 
                features like saved scan lists.
              </p>
              <p>
                Use MetaDefender Community as your go-to online file scanner, download checker, and virus 
                cleaner free.
              </p>
              <p className="modal-footer-text">
                <strong>No installation required.</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UrlForm;