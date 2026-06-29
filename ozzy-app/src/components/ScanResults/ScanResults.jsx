import React, { useState } from 'react';
import './ScanResults.css';
import { parseHyperlinks, URL_VERDICT } from '../../utils/engineLogs';
// NOTE: The ChatBot is rendered once at the App level (see App.jsx) so its
// conversation persists across the main page and this results page. Do not
// render a second instance here — that would reset the chat on navigation.

const ScanResults = ({
  scanData,
  // sandboxData, // Sandbox feature disabled
  urlData,
  agathaResult,
  agathaMode = 'detection',
  multiscanningEnabled,
  scanFile,
  scanType, 
  onNewScan,
  user 
}) => {
  const exportResults = () => {
    const exportData = {
      scanType,
      timestamp: new Date().toISOString(),
      fileInfo: getFileInfo(),
      threatsFound,
      totalEngines,
      agathaResult: agathaResult || null,
      engineResults,
      scanData: scanType === 'file' ? scanData : null,
      urlData: scanType === 'url' ? urlData : null,
      // sandboxData // Sandbox feature disabled
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
        name: urlData.address || 'URL Scan',
        type: 'URL',
        size: null,
        sha256: null,
        extension: 'url',
        address: urlData.address,
        domain: urlData.whois?.domain_name || null
      };
    }
    
    if (scanData?.file_info) {
      return {
        name: scanData.file_info.display_name || scanData.file_info.orig_name || 'Unknown',
        type: scanData.file_info.file_type_description || scanData?.filetype_info?.file_info?.description || 'Unknown',
        size: scanData.file_info.file_size,
        sha256: scanData.file_info.sha256,
        sha1: scanData.file_info.sha1,
        md5: scanData.file_info.md5,
        extension: scanData.file_info.file_type_extension || 'unknown',
        category: scanData.file_info.file_type_category || scanData?.filetype_info?.file_info?.groupID || 'D',
        trid: scanData.file_info.trid_description || scanData?.filetype_info?.other_detections?.find(d => d.detector === 'TrID')?.description,
        libmagic: scanData.file_info.libmagic_description || scanData?.filetype_info?.other_detections?.find(d => d.detector === 'libmagic')?.description,
        magika: scanData.file_info.magika_description || scanData?.filetype_info?.other_detections?.find(d => d.detector === 'Magika')?.description,
        entropy: scanData.file_info.entropy,
        architecture: scanData.file_info.architecture,
        isDotNet: scanData.file_info.is_dotnet,
        isPacked: scanData.file_info.is_packed,
        isDigitallySigned: scanData.file_info.is_digitally_signed,
        uploadTimestamp: scanData.file_info.upload_timestamp,
        ssdeep: scanData.file_info.ssdeep,
        threatName: scanData.threat_name,
        malwareFamily: scanData.malware_family,
        malwareType: scanData.malware_type
      };
    }

    // Fallback: populate from the raw File object when multiscanning is off
    if (scanFile) {
      const fileName = scanFile.name || 'Unknown';
      const ext = fileName.includes('.') ? fileName.split('.').pop() : 'unknown';
      return {
        name: fileName,
        type: scanFile.type || 'Unknown',
        size: scanFile.size,
        extension: ext,
        category: null,
        sha256: null,
        sha1: null,
        md5: null,
      };
    }
    
    return null;
  };

  const getScanEnginesResults = () => {
    if (scanType === 'url' && urlData?.lookup_results?.sources) {
      // Assessments that mean "no threat". Anything outside this set (e.g.
      // malicious, phishing, suspicious) is treated as a detection. Only
      // flagging non-safe assessments avoids miscounting clean verdicts like
      // "benign" or "no_threat" as threats.
      const SAFE_ASSESSMENTS = ['trustworthy', 'likely_trustworthy', 'benign', 'no_threat', 'clean'];
      return urlData.lookup_results.sources
        .filter(source => source.status !== 5) // Filter out sources with status 5 (not available)
        .map(source => {
          const assessment = (source.assessment || '').toLowerCase();
          return {
            name: source.provider,
            verdict: source.assessment || 'Unknown',
            threat: !!assessment && !SAFE_ASSESSMENTS.includes(assessment),
            scanTime: source.update_time,
            defTime: source.detect_time,
            category: source.category,
            status: source.status
          };
        });
    }
    
    if (scanData?.scan_results) {
      // Handle new file scan format with scan_details
      if (scanData.scan_results.scan_details) {
        return Object.entries(scanData.scan_results.scan_details).map(([engineName, result]) => {
          const hasThreat = result.threat_found && result.threat_found.trim() !== '';
          
          return {
            name: engineName,
            verdict: result.threat_found || 'No Threats Detected',
            threat: hasThreat,
            scanTime: result.scan_time,
            defTime: result.def_time,
            scanResult: result.scan_result_i,
            version: result.version
          };
        });
      }
      
      // Handle legacy format
      if (scanData.scan_results.scan_all_result_a) {
        return Object.entries(scanData.scan_results.scan_all_result_a).map(([engineKey, result]) => {
          // Extract proper engine name from the key or use display_name if available
          let engineName = result.display_name || result.engine || engineKey;
          
          // Clean up engine name if it's numeric or not descriptive
          if (!isNaN(engineName) || engineName === engineKey) {
            // Try to get a more descriptive name from common mappings
            const engineNames = {
              '1': 'AhnLab',
              '2': 'Avira', 
              '3': 'Bitdefender',
              '4': 'Bkav Pro',
              '5': 'ClamAV',
              '6': 'CMC',
              '7': 'Comodo',
              '8': 'Emsisoft',
              '9': 'IKARUS',
              '10': 'K7',
              '11': 'Lionic',
              '12': 'McAfee',
              '13': 'NANOAV',
              '14': 'Quick Heal',
              '15': 'TACHYON',
              '16': 'Varist',
              '17': 'Xvirus Anti-Malware',
              '18': 'Zillya',
              '19': 'VirIT eXplorer'
            };
            engineName = engineNames[engineKey] || `Engine ${engineKey}`;
          }
          
          return {
            name: engineName,
            verdict: result.threat_found || 'No Threats Detected',
            threat: result.threat_found && result.threat_found.toLowerCase() !== 'no threat detected',
            scanTime: result.scan_time || result.def_time,
            defTime: result.def_time,
            scanResult: result.scan_result_i,
            version: result.version
          };
        });
      }
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
    if (!dateString || dateString === 0 || dateString === '0') return 'N/A';
    // Handle Unix timestamps (seconds) — if it's a number less than a reasonable ms timestamp
    const val = typeof dateString === 'string' ? Date.parse(dateString) : dateString;
    if (typeof dateString === 'number' && dateString < 1e12) {
      // Unix seconds → convert to ms
      const d = new Date(dateString * 1000);
      return d.getFullYear() <= 1970 ? 'N/A' : d.toLocaleString();
    }
    const d = new Date(dateString);
    return isNaN(d.getTime()) || d.getFullYear() <= 1970 ? 'N/A' : d.toLocaleString();
  };

  const fileInfo = getFileInfo();

  // Multiscanning / URL-reputation engines only. Agatha is tracked separately
  // so each status card reflects exactly its own source.
  const multiscanEngines = getScanEnginesResults();
  const multiscanThreats = multiscanEngines.filter(engine => engine.threat).length;

  // Build the Agatha entry separately, then prepend it to the combined table.
  let agathaEntry = null;
  if (agathaResult && agathaResult.verdict !== undefined) {
    const fileModeUsed = agathaResult.mode || agathaMode;
    const fileUncertain = fileModeUsed === 'deflection' && agathaResult.verdict === 2;
    const verdictMap = {
      0: 'No Threats Detected',
      1: 'Infected',
      2: fileUncertain ? 'Unknown — forward to multiscanning' : 'Unknown',
      3: 'Unsupported File Type',
      '-1': 'Unavailable',
    };
    agathaEntry = {
      // Always display as "Agatha" regardless of any legacy engine label
      // returned by the API or stored in history.
      name: 'Agatha',
      verdict: agathaResult.verdict === 1
        ? agathaResult.threat_name || 'Malicious'
        : agathaResult.error || verdictMap[agathaResult.verdict] || 'No Threats Detected',
      // Deflection's Unknown band is NOT a threat — it forwards to multiscanning.
      threat: agathaResult.verdict === 1,
      scanTime: agathaResult.scan_time,
      defTime: agathaResult.scan_time,
      isAgatha: true,
    };
  }

  // Agatha URL (Hyperlink) verdict travels merged into urlData under `.agatha`.
  // Its verdict codes differ from the file engine: 0 clean · 1 malicious ·
  // 2 suspicious · -1 unavailable (no "unsupported" case for URLs).
  const urlAgatha = scanType === 'url' ? (urlData?.agatha || null) : null;
  let urlAgathaEntry = null;
  if (urlAgatha && urlAgatha.verdict !== undefined) {
    // The URL engine is mode-agnostic and never echoes a file-scan mode. Its
    // verdict 2 ("Suspicious") is its own amber state — NOT a red threat and
    // NOT counted in threatsFound — regardless of the file-scan operating mode.
    const urlVerdictMap = {
      0: 'No Threats Detected',
      1: 'Malicious',
      2: 'Suspicious',
      '-1': 'Unavailable',
    };
    urlAgathaEntry = {
      name: 'Aegis',
      verdict: urlAgatha.error
        ? 'Engine Unavailable'
        : urlAgatha.verdict === 1
          ? (urlAgatha.threat_name || 'Malicious')
          : urlVerdictMap[urlAgatha.verdict] || 'No Threats Detected',
      // Only verdict 1 (malicious) is a red threat. Verdict 2 (suspicious) is an
      // amber advisory state and is never counted as a threat.
      threat: urlAgatha.verdict === 1,
      scanTime: urlAgatha.scan_time,
      defTime: urlAgatha.scan_time,
      isAgatha: true,
    };
  }

  // Hyperlinks the file engine extracted + scored during deepscan (PDF/OOXML).
  // The scores live in the engine diagnostics log, so we parse them from there
  // (same source the Logs panel uses) rather than a dedicated API field.
  const agathaLinks = scanType === 'file' ? parseHyperlinks(agathaResult?.engine_logs) : [];

  // Combined engine list (Agatha first) used by the Engine/Sources table and
  // its overall verdict — so a detection from *any* engine is reflected.
  const leadEntry = scanType === 'url' ? urlAgathaEntry : agathaEntry;
  const engineResults = leadEntry ? [leadEntry, ...multiscanEngines] : multiscanEngines;
  const totalEngines = engineResults.length;
  const threatsFound = engineResults.filter(engine => engine.threat).length;

  if (!fileInfo && !agathaResult && !urlAgatha) {
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
              <span className="file-extension">
                {scanType === 'url' ? '🔗' : (fileInfo?.extension?.toUpperCase() || 'FILE').slice(0, 4)}
              </span>
            </div>
            <div className="file-details">
              <h1>{fileInfo?.name || 'Unknown'}</h1>
              {scanType === 'url' && fileInfo?.domain && (
                <div className="hash-info">
                  <span className="hash-label">Domain:</span>
                  <span className="hash-value">{fileInfo.domain}</span>
                </div>
              )}
              {scanType === 'file' && fileInfo?.sha256 && (
                <div className="hash-info">
                  <span className="hash-label">SHA-256:</span>
                  <span className="hash-value">{fileInfo.sha256}</span>
                </div>
              )}
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
          {multiscanningEnabled && (
            <div className={`status-card multiscanning ${multiscanThreats === 0 ? 'clean' : 'threat'}`}>
              <div className="status-icon">
                <span className="icon">🛡️</span>
              </div>
              <div className="status-content">
                <h3>{scanType === 'url' ? 'URL Reputation' : 'Multiscanning'}</h3>
                <p className={multiscanThreats === 0 ? 'status-clean' : 'status-threat'}>
                  {multiscanThreats === 0
                    ? 'No Threats Detected'
                    : `${multiscanThreats} ${multiscanThreats === 1 ? 'Threat' : 'Threats'} Found`}
                </p>
                {fileInfo?.threatName && (
                  <p className="threat-name">{fileInfo.threatName}</p>
                )}
              </div>
            </div>
          )}

          {scanType === 'url' && urlAgatha && (() => {
            // The URL engine is mode-agnostic. Verdict 2 ("Suspicious") is its
            // own amber state regardless of the file-scan operating mode — never
            // a red threat. Only verdict 1 (malicious) is red.
            const urlSuspicious = urlAgatha.verdict === 2;
            const urlTone = urlAgatha.verdict === 0
              ? 'clean'
              : urlAgatha.verdict === 1
                ? 'threat'
                : urlSuspicious
                  ? 'uncertain'
                  : 'neutral';
            return (
            <div className={`status-card agatha ${urlTone}`}>
              <div className="status-icon">
                <span className="icon">⚔️</span>
              </div>
              <div className="status-content">
                <div className="status-card-titlerow">
                  <h3>Aegis</h3>
                </div>
                <p className={
                  urlAgatha.verdict === 0
                    ? 'status-clean'
                    : urlAgatha.verdict === 1
                      ? 'status-threat'
                      : urlSuspicious
                        ? 'status-uncertain'
                        : 'status-neutral'
                }>
                  {urlAgatha.error
                    ? 'Engine Unavailable'
                    : urlAgatha.verdict === 0
                      ? 'No Threats Detected'
                      : urlAgatha.verdict === 1
                        ? (urlAgatha.threat_name || 'Malicious')
                        : urlSuspicious
                          ? 'Suspicious'
                          : 'Unknown'
                  }
                </p>
                {urlAgatha.malicious_probability != null && !urlAgatha.error && (
                  urlSuspicious ? (
                    <p className="agatha-probability">
                      Malicious probability: {urlAgatha.malicious_probability.toFixed(1)}%
                    </p>
                  ) : (
                    <p className="agatha-probability">
                      Confidence: {urlAgatha.malicious_probability.toFixed(1)}% malicious
                    </p>
                  )
                )}
              </div>
            </div>
            );
          })()}

          {scanType === 'url' && urlData?.whois && (
            <div className="status-card whois">
              <div className="status-icon">
                <span className="icon">🌐</span>
              </div>
              <div className="status-content">
                <h3>WHOIS Information</h3>
                <p className="status-neutral">
                  {urlData.whois.registrant_organization || 'Available'}
                </p>
              </div>
            </div>
          )}

          {scanType === 'file' && agathaResult && (() => {
            // Which regime produced this verdict. The API echoes it back as
            // `agathaResult.mode`; fall back to the user's selected mode.
            const fileMode = agathaResult.mode || agathaMode;
            // In Deflection mode, verdict 2 (Unknown) is a first-class state:
            // "uncertain — forward to multiscanning". Render it amber/neutral,
            // never red and never "blocked". In Detection mode only clean (0)
            // and infected (1) occur.
            const isUncertain = fileMode === 'deflection' && agathaResult.verdict === 2;
            const cardTone = agathaResult.verdict === 0
              ? 'clean'
              : agathaResult.verdict === 1
                ? 'threat'
                : isUncertain
                  ? 'uncertain'
                  : 'neutral';
            return (
            <div className={`status-card agatha ${cardTone}`}>
              <div className="status-icon">
                <span className="icon">⚔️</span>
              </div>
              <div className="status-content">
                <div className="status-card-titlerow">
                  <h3>Agatha</h3>
                  <span className={`mode-badge mode-${fileMode}`}>
                    Mode: {fileMode === 'deflection' ? 'Deflection' : 'Detection'}
                  </span>
                </div>
                <p className={
                  agathaResult.verdict === 0
                    ? 'status-clean'
                    : agathaResult.verdict === 1
                      ? 'status-threat'
                      : isUncertain
                        ? 'status-uncertain'
                        : 'status-neutral'
                }>
                  {agathaResult.error
                    ? 'Engine Unavailable'
                    : agathaResult.verdict === 0
                      ? 'No Threats Detected'
                      : agathaResult.verdict === 1
                        ? (agathaResult.threat_name || 'Malicious')
                        : agathaResult.verdict === 3
                          ? 'Unsupported File Type'
                          : isUncertain
                            ? 'Unknown — forward to multiscanning'
                            : 'Unknown'
                  }
                </p>
                {isUncertain && (
                  <p className="agatha-probability">
                    Below the deflection confidence band — escalate to a heavier multiscanning platform.
                  </p>
                )}
                {agathaResult.malicious_probability != null && !agathaResult.error &&
                  agathaResult.verdict !== 3 && (
                  isUncertain ? (
                    <p className="agatha-probability">
                      Malicious probability: {agathaResult.malicious_probability.toFixed(1)}% (below decision threshold — forwarded)
                    </p>
                  ) : (
                    <p className="agatha-probability">
                      Confidence: {agathaResult.malicious_probability.toFixed(1)}% malicious
                    </p>
                  )
                )}
              </div>
            </div>
            );
          })()}

        </div>

        {/* Extracted links (PDF/OOXML deepscan): URLs found in the document and
            the URL model's verdict/score, parsed from the engine diagnostics. */}
        {scanType === 'file' && agathaLinks.length > 0 && (
          <div className="agatha-links-section">
            <div className="section-header">
              <h2>Extracted Links</h2>
              <span className="agatha-links-sub">{agathaLinks.length} URL{agathaLinks.length > 1 ? 's' : ''} scored by the Aegis URL model (deepscan)</span>
            </div>
            <div className="agatha-links-list">
              {agathaLinks.map((link, i) => {
                const label = URL_VERDICT[link.verdict] || link.verdict || '?';
                const cls = (label || '').toLowerCase();
                const malPct = link.malicious != null ? (parseFloat(link.malicious) * 100) : null;
                return (
                  <div className="agatha-link-row" key={i}>
                    <span className={`agatha-link-badge verdict-${cls}`}>{label}</span>
                    <span className="agatha-link-url" title={link.url || ''}>{link.url || '(no url)'}</span>
                    {malPct != null && !Number.isNaN(malPct) && (
                      <span className="agatha-link-score">{malPct.toFixed(1)}% malicious</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="main-content">
          <div className="left-panel">
            {/* Multiscanning Section */}
            {(multiscanningEnabled || engineResults.length > 0) && (
            <div className="multiscanning-section">
              <div className="section-header">
                <h2>{scanType === 'url' ? 'URL Reputation Sources' : 'Engine Results'}</h2>
                <div className="threat-indicator">
                  <span className={`threat-count ${threatsFound === 0 ? 'clean' : 'threat'}`}>
                    {threatsFound}
                  </span>
                  <span className="total-engines">/{totalEngines}</span>
                  <span className="engines-label">{scanType === 'url' ? 'SOURCES' : 'ENGINES'}</span>
                </div>
              </div>

              <div className={`scan-status ${threatsFound === 0 ? 'clean' : 'threat'}`}>
                {threatsFound === 0
                  ? 'No Threats Detected'
                  : `${threatsFound} ${threatsFound === 1 ? 'Threat' : 'Threats'} Detected`}
              </div>

              <div className="engines-table">
                <div className="table-header">
                  <div className="col-engine">{scanType === 'url' ? 'Source' : 'Engine Name'}</div>
                  <div className="col-verdict">{scanType === 'url' ? 'Assessment' : 'Verdict'}</div>
                  <div className="col-update">Last update</div>
                </div>
                <div className="table-body">
                  {engineResults.map((engine, index) => (
                    <div key={index} className={`engine-row ${engine.isAgatha ? 'agatha-row ' : ''}${engine.threat ? 'threat' : 'clean'}`}>
                      <div className="col-engine">
                        {engine.isAgatha && <span className="agatha-badge">AI</span>}
                        <span className="engine-name">
                          {engine.name}
                        </span>
                        {scanType === 'url' && engine.category && (
                          <span className="engine-category"> ({engine.category})</span>
                        )}
                      </div>
                      <div className="col-verdict">
                        <span className={`verdict ${engine.threat ? 'threat' : 'clean'}`}>
                          {engine.verdict || 'Unknown'}
                        </span>
                      </div>
                      <div className="col-update">
                        <span className="update-time">
                          {engine.defTime ? formatDate(engine.defTime) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}
          </div>

          <div className="right-panel">
            {/* URL panels (Agatha assessment + WHOIS) or File Overview */}
            {scanType === 'url' ? (
              <>
              {urlAgatha && (
                <div className="file-overview-section">
                  <h2>Aegis URL Assessment</h2>

                  <div className="overview-grid">
                    <div className="overview-item full-width">
                      <span className="label">URL</span>
                      <span className="value">{urlData?.address || urlAgatha.url}</span>
                    </div>

                    <div className="overview-item">
                      <span className="label">Verdict</span>
                      <span className={`value ${urlAgatha.verdict === 1 ? 'threat' : ''}`}>
                        {urlAgatha.error
                          ? 'Unavailable'
                          : urlAgatha.verdict === 0
                            ? 'Clean'
                            : urlAgatha.verdict === 1
                              ? 'Malicious'
                              : urlAgatha.verdict === 2
                                ? 'Suspicious'
                                : 'Unknown'}
                      </span>
                    </div>

                    {urlAgatha.malicious_probability != null && !urlAgatha.error && (
                      <div className="overview-item">
                        <span className="label">Malicious Confidence</span>
                        <span className="value">{urlAgatha.malicious_probability.toFixed(1)}%</span>
                      </div>
                    )}

                    {urlAgatha.benign_probability != null && !urlAgatha.error && (
                      <div className="overview-item">
                        <span className="label">Benign Confidence</span>
                        <span className="value">{urlAgatha.benign_probability.toFixed(1)}%</span>
                      </div>
                    )}

                    {urlAgatha.scan_time && (
                      <div className="overview-item">
                        <span className="label">Scan Time</span>
                        <span className="value">{formatDate(urlAgatha.scan_time)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {urlData?.whois && (
              <div className="file-overview-section">
                <h2>WHOIS Information</h2>

                <div className="overview-grid">
                  <div className="overview-item full-width">
                    <span className="label">URL</span>
                    <span className="value">{urlData.address}</span>
                  </div>

                  <div className="overview-item">
                    <span className="label">Domain Name</span>
                    <span className="value">{urlData.whois.domain_name || 'N/A'}</span>
                  </div>

                  {urlData.whois.registrant_organization && (
                    <div className="overview-item">
                      <span className="label">Organization</span>
                      <span className="value">{urlData.whois.registrant_organization}</span>
                    </div>
                  )}
                  
                  {urlData.whois.registrant_country && (
                    <div className="overview-item">
                      <span className="label">Country</span>
                      <span className="value">{urlData.whois.registrant_country}</span>
                    </div>
                  )}
                  
                  {urlData.whois.create_date && (
                    <div className="overview-item">
                      <span className="label">Created Date</span>
                      <span className="value">{urlData.whois.create_date}</span>
                    </div>
                  )}
                  
                  {urlData.whois.expire_date && (
                    <div className="overview-item">
                      <span className="label">Expiration Date</span>
                      <span className="value">{urlData.whois.expire_date}</span>
                    </div>
                  )}
                  
                  {urlData.whois.reg_update_date && (
                    <div className="overview-item">
                      <span className="label">Last Updated</span>
                      <span className="value">{urlData.whois.reg_update_date}</span>
                    </div>
                  )}
                  
                  {urlData.whois.registrar_name && (
                    <div className="overview-item">
                      <span className="label">Registrar</span>
                      <span className="value">{urlData.whois.registrar_name}</span>
                    </div>
                  )}
                  
                  {urlData.whois.name_servers && (
                    <div className="overview-item full-width">
                      <span className="label">Name Servers</span>
                      <span className="value">{urlData.whois.name_servers}</span>
                    </div>
                  )}
                  
                  {urlData.whois.registrant_email && (
                    <div className="overview-item full-width">
                      <span className="label">Contact Email</span>
                      <span className="value">{urlData.whois.registrant_email}</span>
                    </div>
                  )}
                  
                  {urlData.lookup_results?.start_time && (
                    <div className="overview-item">
                      <span className="label">Scan Time</span>
                      <span className="value">{formatDate(urlData.lookup_results.start_time)}</span>
                    </div>
                  )}
                </div>
              </div>
              )}
              </>
            ) : (
              <div className="file-overview-section">
                <h2>File Overview</h2>
                
                <div className="overview-grid">
                  {fileInfo?.threatName && (
                    <div className="overview-item full-width threat-info">
                      <span className="label">Threat Name</span>
                      <span className="value threat">{fileInfo.threatName}</span>
                    </div>
                  )}
                  
                  {fileInfo?.malwareFamily && (
                    <div className="overview-item">
                      <span className="label">Malware Family</span>
                      <span className="value threat">{fileInfo.malwareFamily}</span>
                    </div>
                  )}
                  
                  {fileInfo?.malwareType && Array.isArray(fileInfo.malwareType) && (
                    <div className="overview-item">
                      <span className="label">Malware Type</span>
                      <span className="value threat">{fileInfo.malwareType.join(', ')}</span>
                    </div>
                  )}
                  
                  {fileInfo?.category && (
                    <div className="overview-item">
                      <span className="label">Category</span>
                      <span className="value">{fileInfo.category}</span>
                    </div>
                  )}
                  
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
                  
                  {fileInfo?.md5 && (
                    <div className="overview-item full-width">
                      <span className="label">MD5</span>
                      <span className="value hash">{fileInfo.md5}</span>
                    </div>
                  )}
                  
                  {fileInfo?.sha1 && (
                    <div className="overview-item full-width">
                      <span className="label">SHA-1</span>
                      <span className="value hash">{fileInfo.sha1}</span>
                    </div>
                  )}
                  
                  {fileInfo?.sha256 && (
                    <div className="overview-item full-width">
                      <span className="label">SHA-256</span>
                      <span className="value hash">{fileInfo.sha256}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sandbox Analysis — feature disabled, only multiscanning + Agatha are active.
            {sandboxData && (
              <div className="sandbox-section">
                <h2>Sandbox Analysis</h2>
                
                <div className="sandbox-header">
                  <div className="sandbox-threat-score">
                    <span className="threat-score-number">{sandboxData.threat_score || 75}</span>
                    <span className="threat-score-label">/100 THREAT SCORE</span>
                  </div>
                  <div className="sandbox-verdict">
                    <span className="verdict-badge likely-malicious">Likely Malicious</span>
                  </div>
                </div>

                <div className="sandbox-tags">
                  {sandboxData.tags && sandboxData.tags.map((tag, index) => (
                    <span key={index} className="sandbox-tag">{tag}</span>
                  ))}
                </div>

                {sandboxData.threat_indicators && (
                  <div className="threat-indicators">
                    <h3>Threat Indicators</h3>
                    <p className="indicators-subtitle">Key indicators and MITRE ATT&CK techniques</p>
                    
                    {sandboxData.threat_indicators.likely_malicious && (
                      <div className="indicator-group likely-malicious">
                        <div className="indicator-header">
                          <span className="indicator-label">Likely Malicious Indicators</span>
                          <span className="indicator-count">{sandboxData.threat_indicators.likely_malicious.length}</span>
                        </div>
                        <div className="indicator-list">
                          {sandboxData.threat_indicators.likely_malicious.map((indicator, index) => (
                            <div key={index} className="indicator-item">
                              <span className="indicator-icon">⚠️</span>
                              <span className="indicator-text">{indicator.description || indicator}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sandboxData.threat_indicators.suspicious && (
                      <div className="indicator-group suspicious">
                        <div className="indicator-header">
                          <span className="indicator-label">Suspicious Indicators</span>
                          <span className="indicator-count">{sandboxData.threat_indicators.suspicious.length}</span>
                        </div>
                        <div className="indicator-list">
                          {sandboxData.threat_indicators.suspicious.map((indicator, index) => (
                            <div key={index} className="indicator-item">
                              <span className="indicator-icon">🔶</span>
                              <span className="indicator-text">{indicator.description || indicator}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sandboxData.threat_indicators.no_threats && (
                      <div className="indicator-group no-threats">
                        <div className="indicator-header">
                          <span className="indicator-label">No Threat Indicators</span>
                          <span className="indicator-count">{sandboxData.threat_indicators.no_threats.length}</span>
                        </div>
                        <div className="indicator-list">
                          {sandboxData.threat_indicators.no_threats.slice(0, 2).map((indicator, index) => (
                            <div key={index} className="indicator-item">
                              <span className="indicator-icon">✅</span>
                              <span className="indicator-text">{indicator.description || indicator}</span>
                            </div>
                          ))}
                        </div>
                        {sandboxData.threat_indicators.no_threats.length > 2 && (
                          <button className="show-more-btn">+ {sandboxData.threat_indicators.no_threats.length - 2} more indicators</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {sandboxData.iocs && (
                  <div className="indicators-compromise">
                    <h3>Indicators of Compromise</h3>
                    <p className="iocs-subtitle">Extracted and derived IOCs</p>
                    
                    <div className="iocs-grid">
                      {sandboxData.iocs.md5 && (
                        <div className="ioc-item">
                          <span className="ioc-icon">🔒</span>
                          <span className="ioc-label">MD5</span>
                          <span className="ioc-count">{Array.isArray(sandboxData.iocs.md5) ? sandboxData.iocs.md5.length : 1}</span>
                        </div>
                      )}
                      {sandboxData.iocs.sha1 && (
                        <div className="ioc-item">
                          <span className="ioc-icon">🔒</span>
                          <span className="ioc-label">SHA1</span>
                          <span className="ioc-count">{Array.isArray(sandboxData.iocs.sha1) ? sandboxData.iocs.sha1.length : 1}</span>
                        </div>
                      )}
                      {sandboxData.iocs.sha256 && (
                        <div className="ioc-item">
                          <span className="ioc-icon">🔒</span>
                          <span className="ioc-label">SHA-256</span>
                          <span className="ioc-count">{Array.isArray(sandboxData.iocs.sha256) ? sandboxData.iocs.sha256.length : 1}</span>
                        </div>
                      )}
                      {sandboxData.iocs.uuid && (
                        <div className="ioc-item">
                          <span className="ioc-icon">🆔</span>
                          <span className="ioc-label">UUID</span>
                          <span className="ioc-count">{Array.isArray(sandboxData.iocs.uuid) ? sandboxData.iocs.uuid.length : 1}</span>
                        </div>
                      )}
                    </div>

                    {sandboxData.yara_rules && (
                      <div className="yara-rules">
                        <div className="yara-item">
                          <span className="yara-label">pe_number_of_sections_uncommon</span>
                          <span className="yara-status suspicious">Suspicious</span>
                        </div>
                        <div className="yara-item">
                          <span className="yara-label">dbgdetect_funcs</span>
                          <span className="yara-status no-threats">No Threats Detected</span>
                        </div>
                        <div className="yara-item">
                          <span className="yara-label">ThreadControl__Context</span>
                          <span className="yara-status no-threats">No Threats Detected</span>
                        </div>
                        <div className="yara-item">
                          <span className="yara-label">SEH__vectored</span>
                          <span className="yara-status no-threats">No Threats Detected</span>
                        </div>
                        <button className="show-more-btn">+ 2 more rules</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            */}

            {/* Scan Details */}
            <div className="scan-history-section">
              <h2>Scan Details</h2>
              <p className="scan-history-info">
                {(() => {
                  const scannedAt = scanType === 'url'
                    ? urlData?.lookup_results?.start_time
                    : (scanData?.scan_results?.scan_time || agathaResult?.scan_time);
                  const when = scannedAt ? formatDate(scannedAt) : null;
                  return when && when !== 'N/A'
                    ? `Last scanned on ${when}`
                    : `${scanType === 'url' ? 'URL' : 'File'} scanned just now`;
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* The ChatBot is mounted once at the App level so the conversation
          carries over between this page and the main page. */}
    </div>
  );
};

export default ScanResults;