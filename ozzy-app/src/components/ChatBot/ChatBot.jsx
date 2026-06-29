import { useEffect, useRef, useState } from "react";
import ChatbotIcon from "./ChatbotIcon";
import ChatForm from "./ChatForm";
import ChatMessage from "./ChatMessage";
import InitialMessage from "./InitialMessage";
import ClearHistoryButton from "./ClearHistoryButton";
import "./ChatBot.css";
import axios from 'axios';
import { api } from "../../utils/api";

// The agatha result carries `engine_logs` (the per-scan diagnostics shown in the
// UI Logs panel). Those are ephemeral diagnostics for the live scan — drop them
// before persisting to history so stored entries don't carry the full log/feature
// vector. The in-memory result keeps them for the Logs modal.
const withoutEngineLogs = (agatha) => {
  if (!agatha || typeof agatha !== 'object' || agatha.engine_logs === undefined) return agatha || null;
  const { engine_logs, ...rest } = agatha;
  return rest;
};

// Compact, widget-friendly timestamp: relative for anything in the last week
// ("just now", "5m ago", "3h ago", "2d ago"), then a short absolute date.
// Keeps history rows readable in the narrow popup instead of a full locale
// string like "6/19/2026, 10:29:46 PM".
const formatRelativeTime = (value) => {
  if (!value) return "N/A";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "N/A";
  const diff = Date.now() - then;
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const ChatBot = ({ Data, onSelectHistory, user, onToggle }) => {
  const chatBodyRef = useRef();
  // Remembers the last scan we already persisted (keyed by file id / URL) so the
  // save-on-completion effect stays idempotent: clearing history or a late data
  // update can't re-save the same scan or re-post its success message.
  const savedScanRef = useRef(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [savedChatHistories, setSavedChatHistories] = useState([]);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [showChatHistoryDropdown, setShowChatHistoryDropdown] = useState(false);
  const [localData, setLocalData] = useState(Data || {});
  const [selectedChatHistoryId, setSelectedChatHistoryId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userInitiatedScan, setUserInitiatedScan] = useState(false);
  const [previousScanData, setPreviousScanData] = useState(null);

  // SandboxData disabled — only multiscanning + Agatha are active.
  // AgathaData is the per-file AGATHA engine verdict; it travels alongside the
  // MetaDefender ScanningData so Athena can explain the AI verdict for files
  // (URL Agatha verdicts ride inside UrlScanData.agatha instead).
  const { ScanningData, UrlScanData, AgathaData } = localData;
  // A URL scan is "complete" once we have any URL data — MetaDefender lookup
  // results and/or an Agatha URL verdict (which may be the only source when
  // multiscanning is off).
  const scanCompleted =
    ScanningData?.scan_results?.progress_percentage === 100 ||
    UrlScanData?.lookup_results?.start_time ||
    !!UrlScanData?.address;

  useEffect(() => {
    const currentScanData = JSON.stringify(Data);
    if (currentScanData !== previousScanData) {
      setLocalData(Data || {});
      if (Data && (Data.ScanningData || Data.UrlScanData)) {
        setUserInitiatedScan(true);
      }
      setPreviousScanData(currentScanData);
    }
  }, [Data, previousScanData]);

  useEffect(() => {
    const loadChatHistories = async () => {
      try {
        const histories = await api.getChatHistory();
        setSavedChatHistories(histories);
      } catch (error) {
        console.error('Failed to load chat histories:', error);
      }
    };

    if (showChatbot) {
      loadChatHistories();
    }
  }, [showChatbot]);

  // Notify parent component when chatbot visibility changes
  useEffect(() => {
    if (onToggle) {
      onToggle(showChatbot);
    }
  }, [showChatbot, onToggle]);

  useEffect(() => {
    const loadScanHistory = async () => {
      try {
        const history = await api.getScanHistory();
        setScanHistory(history);
      } catch (error) {
        console.error('Failed to load scan history:', error);
      }
    };

    if (showChatbot) {
      loadScanHistory();
    }
  }, [showChatbot]);

  useEffect(() => {
    if (scanCompleted && userInitiatedScan) {
      let newEntry;
      let scanType = null;

      if (ScanningData) {
        const dataId = ScanningData?.data_id || "";
        const sha1 = ScanningData?.file_info?.sha1 || "";
        // const sandboxId = ScanningData?.last_sandbox_id?.[0]?.sandbox_id || ""; // Sandbox disabled
        const displayName = ScanningData?.file_info?.display_name || "Unknown File";
        const verdict = ScanningData?.process_info?.verdicts?.[0] || "No verdict available";

        newEntry = {
          timestamp: new Date(),
          type: "file",
          displayName,
          verdict,
          dataId,
          sha1,
          // sandboxId, // Sandbox disabled
          agatha: withoutEngineLogs(AgathaData),
        };
        scanType = 'file';
      } else if (UrlScanData) {
        const address = UrlScanData?.address || "Unknown URL";
        const sources = UrlScanData?.lookup_results?.sources || [];

        newEntry = {
          timestamp: new Date(),
          type: "url",
          displayName: address,
          sources,
          address,
          agatha: UrlScanData?.agatha || null,
        };
        scanType = 'url';
      }

      if (newEntry) {
        // Persist each distinct scan only once. Anything that re-marks
        // userInitiatedScan for the same scan — clearing chat history while the
        // results page keeps feeding the scan in via props, or a late Agatha
        // result mutating Data — must not re-save the entry or re-post the
        // "scanned successfully" message. That re-trigger is the "it comes back
        // after I delete it" loop.
        const scanKey = scanType === 'file'
          ? `file:${newEntry.dataId || newEntry.sha1 || newEntry.displayName}`
          : `url:${newEntry.address}`;
        if (savedScanRef.current === scanKey) {
          setUserInitiatedScan(false);
          return;
        }
        savedScanRef.current = scanKey;

        api.saveScanHistory(newEntry)
          .then(response => {
            setScanHistory(prev => {
              const exists = prev.some(item => 
                (item.type === 'file' && item.dataId === newEntry.dataId) ||
                (item.type === 'url' && item.address === newEntry.address)
              );
              if (!exists) {
                return [response, ...prev];
              }
              return prev;
            });
            
            setChatHistory((prev) => {
              const message = scanType === 'file' ? "The file was scanned successfully." : "The URL was scanned successfully.";
              const alreadyAdded = prev.some((msg) => msg.text === message);
              if (!alreadyAdded) {
                return [...prev, { role: "model", text: message }];
              }
              return prev;
            });
          })
          .catch(error => {
            console.error('Failed to save scan history:', error);
            setChatHistory(prev => [...prev, { 
              role: "model", 
              text: "Failed to save scan history.", 
              isError: true 
            }]);
          })
          .finally(() => {
            setUserInitiatedScan(false);
          });
      }
    }
  }, [scanCompleted, ScanningData, UrlScanData, AgathaData, userInitiatedScan]);

  const generateBotResponse = async (history) => {
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { role: "model", text, isError };
        return newHistory;
      });
    };

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_history: history,
        scan_results: ScanningData?.scan_results || null,
        file_info: ScanningData?.file_info || null,
        process_info: ScanningData?.process_info || null,
        sanitized_info: ScanningData?.sanitized || null,
        // sandbox_data: SandboxData || null, // Sandbox disabled
        url_data: UrlScanData || null,
        // Strip engine_logs — the RAG backend only reads the verdict fields, so
        // shipping the full diagnostics log on every turn is pure overhead.
        agatha: withoutEngineLogs(AgathaData),
      }),
    };

    try {
      // Stream the answer token-by-token (/ask/stream emits Server-Sent Events)
      // so it appears as it is generated instead of after the whole response is
      // ready — a large perceived-latency win over the old blocking /ask call.
      const response = await fetch('/ask/stream', requestOptions);
      if (!response.ok || !response.body) {
        let detail = "Something went wrong!";
        try {
          const data = await response.json();
          detail = data?.detail || data?.error || detail;
        } catch { /* non-JSON error body */ }
        throw new Error(detail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let rendered = "";
      let streamError = null;
      let streamDone = false;

      // Decouple network reading from rendering. The read loop fills `answer` as
      // fast as chunks arrive; a requestAnimationFrame loop paints the latest
      // text ~once per frame. Without this, bursts of buffered SSE frames resolve
      // as back-to-back microtasks and React 18 batches every setState into a
      // single repaint — so the whole answer pops in at once instead of typing
      // out token by token.
      const paint = () => {
        if (answer !== rendered) {
          rendered = answer;
          updateHistory(rendered);
        }
        if (!streamDone) requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line; keep any partial trailing frame.
          const frames = buffer.split("\n\n");
          buffer = frames.pop();

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.delta) {
                answer += parsed.delta;
              } else if (parsed.error) {
                streamError = parsed.error;
              }
            } catch { /* ignore malformed frame */ }
          }
        }
      } finally {
        streamDone = true;
      }

      if (streamError) throw new Error(streamError);
      // Final flush — paints the last frame and trims trailing whitespace.
      updateHistory(answer.trim() || "No response received.");
    } catch (error) {
      updateHistory(error.message, true);
    }
  };

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chatHistory]);

  const handleSelectScanHistory = async (entry) => {
    setShowScanDropdown(false);

    try {
      let newScanningData = null;
      // let newSandboxData = null; // Sandbox disabled
      let newUrlScanData = null;
      let newAgathaData = null;

      if (entry.type === "file") {
        if (entry.dataId) {
          newScanningData = await api.getScanData(entry.dataId);
        }
        // Restore the stored AGATHA file verdict so Athena can still explain it
        // when a scan is reloaded from history.
        newAgathaData = entry.agatha || null;

        // Sandbox disabled — only multiscanning + Agatha are active.
        // if (entry.sha1 && entry.sandboxId) {
        //   newSandboxData = await api.getSandboxData(entry.sha1);
        // }
      } else if (entry.type === "url") {
        const encodedUrl = encodeURIComponent(entry.address);
        // MetaDefender reputation re-lookup (best-effort — may be unavailable if
        // multiscanning was off for this scan).
        let mdData = null;
        try {
          mdData = await api.getUrlScanData(encodedUrl);
        } catch (e) {
          console.warn("MetaDefender URL re-lookup failed:", e?.message);
        }
        // Re-run the Agatha URL engine so the loaded page shows both verdicts,
        // falling back to the stored verdict if the engine is unavailable.
        let agatha = entry.agatha || null;
        try {
          agatha = await api.getAgathaUrlScan(entry.address);
        } catch (e) {
          console.warn("Agatha URL re-scan failed:", e?.message);
        }
        newUrlScanData = {
          ...(mdData || { address: entry.address }),
          agatha,
        };
      }

      setLocalData({
        ScanningData: newScanningData,
        // SandboxData: newSandboxData, // Sandbox disabled
        UrlScanData: newUrlScanData,
        AgathaData: newAgathaData,
      });

      onSelectHistory?.({
        ScanningData: newScanningData,
        // SandboxData: newSandboxData, // Sandbox disabled
        UrlScanData: newUrlScanData,
        AgathaData: newAgathaData,
      });

      setChatHistory((prev) => {
        const message = entry.type === "file" 
          ? `The file "${entry.displayName}" details was loaded from scan history.`
          : `The URL "${entry.displayName}" details was loaded from scan history.`;
        return [...prev, { role: "model", text: message }];
      });

    } catch (error) {
      console.error("Error fetching scan data:", error);
      setChatHistory((prev) => {
        return [...prev, { 
          role: "model", 
          text: "Error loading scan data from history.", 
          isError: true 
        }];
      });
    }
  };

  const handleSelectChatHistory = async (entry) => {
    setShowChatHistoryDropdown(false);
    
    if (chatHistory.length > 0) {
      await handleSaveChatHistory();
    }

    setChatHistory([]);
    setLocalData({});
    setSelectedChatHistoryId(null);
    
    const convertedMessages = entry.messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'model',
      text: msg.content
    }));
    
    setChatHistory(convertedMessages);
    setLocalData({
      ScanningData: entry.scanData || null,
      // SandboxData: entry.sandboxData || null, // Sandbox disabled
      UrlScanData: entry.urlData || null,
      AgathaData: entry.agathaData || null,
    });

    setSelectedChatHistoryId(entry._id);

    onSelectHistory?.({
      ScanningData: entry.scanData || null,
      // SandboxData: entry.sandboxData || null, // Sandbox disabled
      UrlScanData: entry.urlData || null,
      AgathaData: entry.agathaData || null,
    });
  };

  const handleClearScanHistory = async () => {
    try {
      await api.deleteScanHistory();
      setScanHistory([]);
    } catch (error) {
      console.error('Failed to clear scan history:', error);
    }
  };

  const handleClearChatHistory = async () => {
    try {
      setIsLoading(true);
      await api.deleteChatHistory();
      setSavedChatHistories([]);
      setSelectedChatHistoryId(null);
      setChatHistory([]);
      setLocalData({
        ScanningData: null,
        // SandboxData: null, // Sandbox disabled
        UrlScanData: null,
        AgathaData: null
      });
      setUserInitiatedScan(false);
      // NOTE: do NOT reset previousScanData here. On the results page the parent
      // keeps passing the completed scan in via props; resetting this would make
      // the data-watch effect treat it as a brand-new scan and re-trigger the
      // save (re-adding the history row + success message right after they were
      // cleared).
      onSelectHistory?.({});
    } catch (error) {
      console.error('Failed to clear chat histories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChatHistory = async () => {
    if (chatHistory.length === 0) return;
    setIsLoading(true);

    try {
      const messages = chatHistory.map(msg => ({
        type: msg.role === 'user' ? 'user' : 'bot',
        content: msg.text
      }));

      const historyData = {
        messages,
        scanData: ScanningData || null,
        // sandboxData: SandboxData || null, // Sandbox disabled
        urlData: UrlScanData || null,
        agathaData: withoutEngineLogs(AgathaData),
        chatId: selectedChatHistoryId
      };

      const savedHistory = await api.saveChatHistory(historyData);
      
      setSavedChatHistories(prev => {
        if (selectedChatHistoryId) {
          return prev.map(h => h._id === selectedChatHistoryId ? savedHistory : h);
        }
        return [savedHistory, ...prev];
      });

      setChatHistory([]);
      setLocalData({});
      setSelectedChatHistoryId(null);
      onSelectHistory?.({});
    } catch (error) {
      console.error('Failed to save chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayInfo = (entry) => {
    let verdict, color;

    if (entry.type === "file") {
      verdict = entry.verdict || "No verdict available";
      // Match defensively: verdicts come from different engines and may be
      // worded as "No Threat Detected" (MetaDefender) or "No Threats Detected"
      // (in-app label), and threats as "Infected"/"Malicious".
      const v = verdict.toLowerCase();
      if (v.includes("infected") || v.includes("malicious")) {
        color = "red";
      } else if (v.includes("no threat")) {
        color = "green";
      } else {
        color = "default";
      }
      const name = entry.displayName || "Unknown File";
      return {
        name: name.length > 10 ? `${name.substring(0, 10)}...` : name,
        fullName: name,
        verdict,
        color,
      };
    } else if (entry.type === "url") {
      const sources = entry.sources || [];
      const agatha = entry.agatha;

      // Lead with the Agatha URL verdict so history matches the results page
      // ("No Threats Detected" rather than MetaDefender's "Trustworthy"). Fall
      // back to reputation sources only when no Agatha verdict was stored.
      if (agatha && agatha.verdict !== undefined && agatha.verdict !== null) {
        if (agatha.error || agatha.verdict === -1) {
          verdict = "Unavailable";
          color = "default";
        } else if (agatha.verdict === 0) {
          verdict = "No Threats Detected";
          color = "green";
        } else if (agatha.verdict === 1) {
          verdict = agatha.threat_name || "Malicious";
          color = "red";
        } else if (agatha.verdict === 2) {
          verdict = "Suspicious";
          color = "red";
        } else {
          verdict = "Unknown";
          color = "default";
        }
      } else if (sources.length > 0) {
        if (sources.find((s) => s.assessment === "trustworthy")) {
          verdict = "No Threats Detected";
          color = "green";
        } else if (sources.some((s) => s.status === 5)) {
          verdict = "Unknown";
          color = "default";
        } else {
          verdict = "Suspicious";
          color = "red";
        }
      } else {
        verdict = "Unknown";
        color = "default";
      }

      const name = entry.displayName || "Unknown URL";
      return {
        name: name.length > 10 ? `${name.substring(0, 10)}...` : name,
        fullName: name,
        verdict,
        color,
      };
    }
    return { name: "Unknown", fullName: "Unknown", verdict: "No verdict available", color: "default" };
  };

  return (
    <div className={`container ${showChatbot ? "show-chatbot" : ""}`}>
      <button
        onClick={() => setShowChatbot((prev) => !prev)}
        id="chatbot-toggler"
        className={showChatbot ? "" : "has-hover"}
      >
        <span className="material-symbols-rounded">mode_comment</span>
        <span className="material-symbols-rounded">close</span>
      </button>

      <div className="chatbot-popup">
        <div className="chat-header">
          <div className="inner-header">
            <div className="header-info">
              <ChatbotIcon
                onClick={() => {
                  setShowChatHistoryDropdown((prev) => !prev);
                  setShowScanDropdown(false);
                }}
              />
              <h2 className="logo-text">Athena</h2>
            </div>
            <div className="header-buttons">
              <button
                onClick={() => {
                  setShowScanDropdown((prev) => !prev);
                  setShowChatHistoryDropdown(false);
                }}
                className="material-symbols-rounded"
              >
                history
              </button>
              <button 
                onClick={handleSaveChatHistory}
                disabled={isLoading || chatHistory.length === 0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowChatbot(false);
                  setShowScanDropdown(false);
                  setShowChatHistoryDropdown(false);
                }}
                className="material-symbols-rounded"
              >
                close
              </button>
            </div>
          </div>
        </div>

        {showScanDropdown && (
          <div className="history-panel scan-history-dropdown">
            <div className="history-panel-header">
              <span className="history-panel-title">Scan history</span>
              {scanHistory.length > 0 && (
                <span className="history-panel-count">{scanHistory.length}</span>
              )}
            </div>
            <div className="history-scroll">
            {scanHistory.length === 0 ? (
              <div className="history-empty">
                <span className="material-symbols-rounded">history</span>
                <p>No saved scans yet.</p>
              </div>
            ) : (
              <table className="scan-history-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>When</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((entry) => {
                    const { fullName, verdict, color } = getDisplayInfo(entry);
                    return (
                      <tr
                        key={entry._id}
                        className="scan-history-entry"
                        onClick={() => handleSelectScanHistory(entry)}
                      >
                        <td title={fullName}>{fullName}</td>
                        <td title={entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "N/A"}>
                          {formatRelativeTime(entry.timestamp)}
                        </td>
                        <td title={verdict}>
                          <span className={`history-pill pill-${color}`}>{verdict}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            </div>
            {scanHistory.length > 0 && (
              <div className="history-panel-footer">
                <ClearHistoryButton onClear={handleClearScanHistory} label="Clear scans" />
              </div>
            )}
          </div>
        )}

        {showChatHistoryDropdown && (
          <div className="history-panel chat-history-dropdown">
            <div className="history-panel-header">
              <span className="history-panel-title">Chat history</span>
              {savedChatHistories.length > 0 && (
                <span className="history-panel-count">{savedChatHistories.length}</span>
              )}
            </div>
            <div className="history-scroll">
            {savedChatHistories.length === 0 ? (
              <div className="history-empty">
                <span className="material-symbols-rounded">forum</span>
                <p>No saved chats yet.</p>
              </div>
            ) : (
              <table className="chat-history-table">
                <thead>
                  <tr>
                    <th>Last message</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {savedChatHistories.map((entry) => {
                    const lastMessage = entry.messages[entry.messages.length - 1]?.content || "No messages";
                    return (
                      <tr
                        key={entry._id}
                        className="chat-history-entry"
                        onClick={() => handleSelectChatHistory(entry)}
                      >
                        <td title={lastMessage}>{lastMessage}</td>
                        <td title={entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString() : "N/A"}>
                          {formatRelativeTime(entry.lastUpdated)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            </div>
            {savedChatHistories.length > 0 && (
              <div className="history-panel-footer">
                <ClearHistoryButton onClear={handleClearChatHistory} label="Clear chats" />
              </div>
            )}
          </div>
        )}

        <div ref={chatBodyRef} className="chat-body">
          <InitialMessage />
          {chatHistory.map((chat, index) => (
            <ChatMessage 
              key={index} 
              chat={chat} 
              isFirstMessage={false}
            />
          ))}
        </div>

        <div className="chat-footer">
          <ChatForm
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            generateBotResponse={generateBotResponse}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatBot;