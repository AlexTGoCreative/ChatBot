import { useEffect, useRef, useState } from "react";
import ChatbotIcon from "./ChatbotIcon";
import ChatForm from "./ChatForm";
import ChatMessage from "./ChatMessage";
import InitialMessage from "./InitialMessage";
import "./ChatBot.css";
import axios from 'axios';
import { api } from "../../utils/api";

const Chatbot = ({ Data, onSelectHistory }) => {
  const chatBodyRef = useRef();
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

  const { ScanningData, SandboxData, UrlScanData } = localData;
  const scanCompleted = ScanningData?.scan_results?.progress_percentage === 100 || UrlScanData?.lookup_results?.start_time;

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
        const sandboxId = ScanningData?.last_sandbox_id?.[0]?.sandbox_id || "";
        const displayName = ScanningData?.file_info?.display_name || "Unknown File";
        const verdict = ScanningData?.process_info?.verdicts?.[0] || "No verdict available";

        newEntry = {
          timestamp: new Date(),
          type: "file",
          displayName,
          verdict,
          dataId,
          sha1,
          sandboxId,
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
        };
        scanType = 'url';
      }

      if (newEntry) {
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
  }, [scanCompleted, ScanningData, UrlScanData, userInitiatedScan]);

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
        sandbox_data: SandboxData || null,
        url_data: UrlScanData || null,
      }),
    };

    try {
      const response = await fetch('/ask', requestOptions);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Something went wrong!");
      updateHistory(data.answer.trim());
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
      let newSandboxData = null;
      let newUrlScanData = null;

      if (entry.type === "file") {
        if (entry.dataId) {
          newScanningData = await api.getScanData(entry.dataId);
        }

        if (entry.sha1 && entry.sandboxId) {
          newSandboxData = await api.getSandboxData(entry.sha1);
        }
      } else if (entry.type === "url") {
        const encodedUrl = encodeURIComponent(entry.address);
        newUrlScanData = await api.getUrlScanData(encodedUrl);
      }

      setLocalData({
        ScanningData: newScanningData,
        SandboxData: newSandboxData,
        UrlScanData: newUrlScanData,
      });

      onSelectHistory?.({
        ScanningData: newScanningData,
        SandboxData: newSandboxData,
        UrlScanData: newUrlScanData,
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
      SandboxData: entry.sandboxData || null,
      UrlScanData: entry.urlData || null,
    });
    
    setSelectedChatHistoryId(entry._id);
    
    onSelectHistory?.({
      ScanningData: entry.scanData || null,
      SandboxData: entry.sandboxData || null,
      UrlScanData: entry.urlData || null,
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
        SandboxData: null,
        UrlScanData: null
      });
      setUserInitiatedScan(false);
      setPreviousScanData(null);
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
        sandboxData: SandboxData || null,
        urlData: UrlScanData || null,
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
      if (verdict === "No Threat Detected") {
        color = "green";
      } else if (verdict.toLowerCase().includes("infected")) {
        color = "red";
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
      verdict = sources.find((s) => s.assessment === "trustworthy")
        ? "Trustworthy"
        : sources.some((s) => s.status === 5)
        ? "Unknown"
        : "Suspicious";
      if (verdict === "Trustworthy") {
        color = "green";
      } else if (verdict === "Suspicious") {
        color = "red";
      } else {
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
              <h2 className="logo-text">Ozzy</h2>
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
          <div className="scan-history-dropdown">
            <button
              onClick={handleClearScanHistory}
              className="scan-clear-history-button"
            >
              Clear
            </button>
            {scanHistory.length === 0 && <p className="scan-history-empty">No saved scans.</p>}
            {scanHistory.length > 0 && (
              <table className="scan-history-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>SCAN TIME</th>
                    <th>VERDICT</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((entry) => {
                    const { name, fullName, verdict, color } = getDisplayInfo(entry);
                    return (
                      <tr
                        key={entry._id}
                        className="scan-history-entry"
                        onClick={() => handleSelectScanHistory(entry)}
                      >
                        <td title={fullName} className={`scan-history-cell-${color}`}>
                          {name}
                        </td>
                        <td title={entry.timestamp || "N/A"}>{new Date(entry.timestamp).toLocaleString() || "N/A"}</td>
                        <td title={verdict} className={`scan-history-cell-${color}`}>
                          {verdict}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {showChatHistoryDropdown && (
          <div className="chat-history-dropdown">
            <button
              onClick={handleClearChatHistory}
              className="chat-clear-history-button"
            >
              Clear
            </button>
            {savedChatHistories.length === 0 && <p className="chat-history-empty">No saved chats.</p>}
            {savedChatHistories.length > 0 && (
              <table className="chat-history-table">
                <thead>
                  <tr>
                    <th>TIMESTAMP</th>
                    <th>MESSAGES</th>
                  </tr>
                </thead>
                <tbody>
                  {savedChatHistories.map((entry) => {
                    const lastMessage = entry.messages[entry.messages.length - 1]?.content || "No messages";
                    const truncatedMessage = lastMessage.length > 25 ? `${lastMessage.substring(0, 25)}...` : lastMessage;
                    const timestamp = new Date(entry.lastUpdated).toLocaleString();
                    return (
                      <tr
                        key={entry._id}
                        className="chat-history-entry"
                        onClick={() => handleSelectChatHistory(entry)}
                      >
                        <td title={timestamp}>{timestamp}</td>
                        <td title={lastMessage}>{truncatedMessage}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

export default Chatbot;