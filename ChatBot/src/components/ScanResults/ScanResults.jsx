import React, { useState } from 'react';
import './ScanResults.css';

const ScanResults = ({ 
  scanData, 
  sandboxData, 
  urlData, 
  scanType, 
  onNewScan 
}) => {
  const exportResults = () => {
    const exportData = {
      scanType,
      timestamp: new Date().toISOString(),
      fileInfo: getFileInfo(),
      threatScore: getThreatScore(),
      engineResults: getScanEnginesResults(),
      scanData: scanType === 'file' ? scanData : null,
      urlData: scanType === 'url' ? urlData : null,
      sandboxData
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scan-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper functions to extract data
  const getFileInfo = () => {
    if (scanType === 'url' && urlData) {
      return {
        name: urlData.url || 'URL Scan',
        type: 'URL',
        size: null,
        sha256: urlData.hash || 'N/A',
        extension: 'url'
      };
    }
    
    if (scanData?.file_info) {
      return {
        name: scanData.file_info.display_name || scanData.file_info.orig_name || 'Unknown',
        type: scanData.file_info.file_type_description || 'Unknown',
        size: scanData.file_info.file_size,
        sha256: scanData.file_info.sha256,
        sha1: scanData.file_info.sha1,
        md5: scanData.file_info.md5,
        extension: scanData.file_info.file_type_extension || 'unknown',
        category: scanData.file_info.file_type_category || 'D',
        trid: scanData.file_info.trid_description,
        libmagic: scanData.file_info.libmagic_description,
        magika: scanData.file_info.magika_description,
        entropy: scanData.file_info.entropy,
        architecture: scanData.file_info.architecture,
        isDotNet: scanData.file_info.is_dotnet,
        isPacked: scanData.file_info.is_packed,
        isDigitallySigned: scanData.file_info.is_digitally_signed,
        uploadTimestamp: scanData.file_info.upload_timestamp,
        ssdeep: scanData.file_info.ssdeep
      };
    }
    
    return null;
  };

  const getThreatScore = () => {
    if (scanType === 'url' && urlData) {
      return urlData.threat_score || 0;
    }
    
    if (scanData?.scan_results?.scan_all_result_a) {
      const engines = Object.values(scanData.scan_results.scan_all_result_a);
      const threatsDetected = engines.filter(engine => 
        engine.threat_found && engine.threat_found.toLowerCase() !== 'no threat detected'
      ).length;
      
      return Math.round((threatsDetected / engines.length) * 100);
    }
    
    return 0;
  };

  const getScanEnginesResults = () => {
    if (scanType === 'url' && urlData?.scan_results) {
      return urlData.scan_results;
    }
    
    if (scanData?.scan_results?.scan_all_result_a) {
      return Object.entries(scanData.scan_results.scan_all_result_a).map(([name, result]) => ({
        name,
        verdict: result.threat_found || 'No Threats Detected',
        threat: result.threat_found && result.threat_found.toLowerCase() !== 'no threat detected',
        scanTime: result.scan_time,
        defTime: result.def_time,
        scanResult: result.scan_result_i,
        version: result.version
      }));
    }
    
    return [];
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const fileInfo = getFileInfo();
  const threatScore = getThreatScore();
  const engineResults = getScanEnginesResults();
  const totalEngines = engineResults.length;
  const threatsFound = engineResults.filter(engine => engine.threat).length;

  if (!fileInfo) {
    return (
      <div className="scan-results">
        <div className="scan-results-error">
          <h2>No scan data available</h2>
          <button onClick={onNewScan} className="new-scan-btn">
            Start New Scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scan-results">
      <header className="scan-results-header">
        <div className="header-content">
          <div className="file-header">
            <div className="file-icon">
              <span className="file-extension">{fileInfo?.extension?.toUpperCase() || 'FILE'}</span>
            </div>
            <div className="file-details">
              <h1>{fileInfo?.name || 'Unknown File'}</h1>
              <div className="hash-info">
                <span className="hash-label">SHA-256:</span>
                <span className="hash-value">{fileInfo?.sha256}</span>
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={exportResults} className="export-btn">
              Export Results
            </button>
            <button onClick={onNewScan} className="new-scan-btn">
              New Scan
            </button>
          </div>
        </div>
      </header>

      <div className="results-container">
        {/* Status Cards */}
        <div className="status-cards">
          <div className={`status-card multiscanning ${threatScore === 0 ? 'clean' : 'threat'}`}>
            <div className="status-icon">
              <span className="icon">🛡️</span>
            </div>
            <div className="status-content">
              <h3>Multiscanning</h3>
              <p className={threatScore === 0 ? 'status-clean' : 'status-threat'}>
                {threatScore === 0 ? 'No Threats Detected' : `${threatsFound} Threats Found`}
              </p>
            </div>
          </div>

          <div className="status-card sandbox">
            <div className="status-icon">
              <span className="icon">🔬</span>
            </div>
            <div className="status-content">
              <h3>Adaptive Sandbox</h3>
              <p className="status-neutral">
                {sandboxData ? 'Analysis Available' : 'No Results Available'}
              </p>
            </div>
          </div>

          <div className="status-card cdr">
            <div className="status-icon">
              <span className="icon">📄</span>
            </div>
            <div className="status-content">
              <h3>Deep CDR™</h3>
              <p className="status-neutral">No Sanitization Available</p>
            </div>
          </div>

          <div className="status-card dlp">
            <div className="status-icon">
              <span className="icon">🔒</span>
            </div>
            <div className="status-content">
              <h3>Proactive DLP</h3>
              <p className="status-neutral">No Results Available</p>
            </div>
          </div>

          <div className="status-card vulnerabilities">
            <div className="status-icon">
              <span className="icon">🛡️</span>
            </div>
            <div className="status-content">
              <h3>Vulnerabilities</h3>
              <p className="status-clean">No Vulnerabilities Found</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          <div className="left-panel">
            {/* Multiscanning Section */}
            <div className="multiscanning-section">
              <div className="section-header">
                <h2>Multiscanning</h2>
                <div className="threat-indicator">
                  <span className={`threat-count ${threatScore === 0 ? 'clean' : 'threat'}`}>
                    {threatsFound}
                  </span>
                  <span className="total-engines">/{totalEngines}</span>
                  <span className="engines-label">ENGINES</span>
                </div>
              </div>
              
              <div className={`scan-status ${threatScore === 0 ? 'clean' : 'threat'}`}>
                {threatScore === 0 ? 'No Threats Detected' : `${threatsFound} Threats Detected`}
              </div>

              <div className="engines-table">
                <div className="table-header">
                  <div className="col-engine">Engine Name</div>
                  <div className="col-verdict">Verdict</div>
                  <div className="col-update">Last engine update</div>
                </div>
                <div className="table-body">
                  {engineResults.map((engine, index) => (
                    <div key={index} className={`engine-row ${engine.threat ? 'threat' : 'clean'}`}>
                      <div className="col-engine">
                        <span className="engine-name">{engine.name}</span>
                      </div>
                      <div className="col-verdict">
                        <span className={`verdict ${engine.threat ? 'threat' : 'clean'}`}>
                          {engine.verdict}
                        </span>
                      </div>
                      <div className="col-update">
                        <span className="update-time">
                          {engine.scanTime ? formatDate(engine.scanTime) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="right-panel">
            {/* File Overview */}
            <div className="file-overview-section">
              <h2>File Overview</h2>
              
              <div className="overview-grid">
                <div className="overview-item">
                  <span className="label">Category</span>
                  <span className="value">{fileInfo?.category || 'D'}</span>
                </div>
                
                <div className="overview-item">
                  <span className="label">File Type</span>
                  <span className="value">{fileInfo?.type || 'Unknown'}</span>
                </div>
                
                <div className="overview-item">
                  <span className="label">File Extension</span>
                  <span className="value">{fileInfo?.extension || 'unknown'}</span>
                </div>
                
                {fileInfo?.trid && (
                  <div className="overview-item">
                    <span className="label">TrID</span>
                    <span className="value">{fileInfo.trid}</span>
                  </div>
                )}
                
                {fileInfo?.libmagic && (
                  <div className="overview-item">
                    <span className="label">LibMagic</span>
                    <span className="value">{fileInfo.libmagic}</span>
                  </div>
                )}
                
                {fileInfo?.magika && (
                  <div className="overview-item">
                    <span className="label">Magika</span>
                    <span className="value">{fileInfo.magika}</span>
                  </div>
                )}
                
                {fileInfo?.size && (
                  <div className="overview-item">
                    <span className="label">File Size</span>
                    <span className="value">{formatFileSize(fileInfo.size)}</span>
                  </div>
                )}
                
                {fileInfo?.uploadTimestamp && (
                  <div className="overview-item">
                    <span className="label">Uploaded</span>
                    <span className="value">{formatDate(fileInfo.uploadTimestamp)}</span>
                  </div>
                )}
                
                {fileInfo?.ssdeep && (
                  <div className="overview-item full-width">
                    <span className="label">SSDEEP</span>
                    <span className="value ssdeep">{fileInfo.ssdeep}</span>
                  </div>
                )}
                
                {fileInfo?.architecture && (
                  <div className="overview-item">
                    <span className="label">Architecture</span>
                    <span className="value">{fileInfo.architecture}</span>
                  </div>
                )}
                
                {fileInfo?.isDotNet !== undefined && (
                  <div className="overview-item">
                    <span className="label">Is DotNet</span>
                    <span className="value">{fileInfo.isDotNet ? 'Yes' : 'No'}</span>
                  </div>
                )}
                
                {fileInfo?.isPacked !== undefined && (
                  <div className="overview-item">
                    <span className="label">Is Packed</span>
                    <span className="value">{fileInfo.isPacked ? 'Yes' : 'No'}</span>
                  </div>
                )}
                
                {fileInfo?.isDigitallySigned !== undefined && (
                  <div className="overview-item">
                    <span className="label">Is Digitally Signed</span>
                    <span className="value">{fileInfo.isDigitallySigned ? 'Yes' : 'No'}</span>
                  </div>
                )}
                
                {fileInfo?.entropy && (
                  <div className="overview-item">
                    <span className="label">Entropy</span>
                    <span className="value">{fileInfo.entropy}</span>
                  </div>
                )}
                
                {scanData?.scan_results?.scan_time && (
                  <div className="overview-item">
                    <span className="label">Scanned</span>
                    <span className="value">{formatDate(scanData.scan_results.scan_time)}</span>
                  </div>
                )}
                
                <div className="overview-item full-width">
                  <span className="label">MD5</span>
                  <span className="value hash">{fileInfo?.md5 || 'N/A'}</span>
                </div>
                
                <div className="overview-item full-width">
                  <span className="label">SHA-1</span>
                  <span className="value hash">{fileInfo?.sha1 || 'N/A'}</span>
                </div>
                
                <div className="overview-item full-width">
                  <span className="label">SHA-256</span>
                  <span className="value hash">{fileInfo?.sha256 || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Scan History */}
            <div className="scan-history-section">
              <h2>Scan History</h2>
              <p className="scan-history-info">This file has been scanned 1 time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanResults;