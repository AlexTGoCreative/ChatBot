import { useEffect, useRef, useState } from "react";
import ChatbotIcon from "./ChatbotIcon";
import ChatForm from "./ChatForm";
import ChatMessage from "./ChatMessage";
import "./Chatbot.css";
import axios from 'axios';

const Chatbot = ({ Data, onSelectHistory }) => {
  const chatBodyRef = useRef();
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [savedChatHistories, setSavedChatHistories] = useState([]);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [showChatHistoryDropdown, setShowChatHistoryDropdown] = useState(false);
  const [localData, setLocalData] = useState(Data || {});

  const { ScanningData, SandboxData, UrlScanData } = localData;
  const scanCompleted = ScanningData?.scan_results?.progress_percentage === 100 || UrlScanData?.lookup_results?.start_time;

  useEffect(() => {
    setLocalData(Data || {});
  }, [Data]);

  useEffect(() => {
    const savedScans = JSON.parse(localStorage.getItem("scanHistory") || "[]");
    const savedChats = JSON.parse(localStorage.getItem("chatHistories") || "[]");
    setScanHistory(savedScans);
    setSavedChatHistories(savedChats);
  }, []);

  useEffect(() => {
    if (scanCompleted) {
      const timestamp = new Date().toLocaleString();
      let newEntry;

      if (ScanningData) {
        const dataId = ScanningData?.data_id || "";
        const sha1 = ScanningData?.file_info?.sha1 || "";
        const sandboxId = ScanningData?.last_sandbox_id?.[0]?.sandbox_id || "";
        const displayName = ScanningData?.file_info?.display_name || "Unknown File";
        const verdict = ScanningData?.process_info?.verdicts?.[0] || "No verdict available";

        newEntry = {
          id: Date.now(),
          timestamp,
          type: "file",
          displayName,
          verdict,
          dataId,
          sha1,
          sandboxId,
        };
      } else if (UrlScanData) {
        const address = UrlScanData?.address || "Unknown URL";
        const sources = UrlScanData?.lookup_results?.sources || [];

        newEntry = {
          id: Date.now(),
          timestamp,
          type: "url",
          displayName: address,
          sources,
          address,
        };
      }

      if (newEntry) {
        setScanHistory((prev) => {
          const isDuplicate = prev.some((entry) => {
            if (newEntry.type === "file" && entry.type === "file") {
              return entry.displayName === newEntry.displayName && entry.sha1 === newEntry.sha1;
            } else if (newEntry.type === "url" && entry.type === "url") {
              return entry.address === newEntry.address;
            }
            return false;
          });

          if (isDuplicate) {
            return prev;
          }

          const updated = [...prev, newEntry];
          localStorage.setItem("scanHistory", JSON.stringify(updated));
          return updated;
        });

        setChatHistory((prev) => {
          const message = ScanningData ? "The file was scanned successfully." : "The URL was scanned successfully.";
          const alreadyAdded = prev.some((msg) => msg.text === message);
          if (!alreadyAdded) {
            return [...prev, { role: "model", text: message }];
          }
          return prev;
        });
      }
    }
  }, [scanCompleted, ScanningData, UrlScanData]);

  const generateBotResponse = async (history) => {
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text, isError },
      ]);
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

    // console.log("1:",ScanningData);
    // console.log("2:",SandboxData);
    // console.log("3:",UrlScanData);

    try {
      const response = await fetch(import.meta.env.VITE_API_URL, requestOptions);
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
    setShowChatHistoryDropdown(false);

    try {
      let newScanningData = null;
      let newSandboxData = null;
      let newUrlScanData = null;

      if (entry.type === "file") {
        const dataId = entry.dataId;
        const sha1 = entry.sha1;
        const sandboxId = entry.sandboxId;

        if (dataId) {
          const fileResponse = await axios.get(`http://localhost:5000/scan/${dataId}`);
          newScanningData = fileResponse.data;
        }

        if (sandboxId && sha1) {
          const sandboxResponse = await axios.get(`http://localhost:5000/sandbox/${sha1}`);
          newSandboxData = sandboxResponse.data;
        }
      } else if (entry.type === "url") {
        const address = entry.address;
        const encodedUrl = encodeURIComponent(address);
        const urlResponse = await axios.get(
          `http://localhost:5000/scan-url-direct?encodedUrl=${encodedUrl}`,
          {
            headers: { apikey: import.meta.env.VITE_MD_API_KEY },
          }
        );
        newUrlScanData = urlResponse.data;
      }

      setLocalData({
        ScanningData: newScanningData || null,
        SandboxData: newSandboxData || null,
        UrlScanData: newUrlScanData || null,
      });

      onSelectHistory?.({
        ScanningData: newScanningData || null,
        SandboxData: newSandboxData || null,
        UrlScanData: newUrlScanData || null,
      });

    } catch (error) {
      console.error("Error in handleSelectScanHistory:", error);
    }
  };

  const handleSelectChatHistory = (entry) => {
    setShowChatHistoryDropdown(false);
    setShowScanDropdown(false);
    setChatHistory(entry.messages);
    setLocalData({
      ScanningData: entry.ScanningData || null,
      SandboxData: entry.SandboxData || null,
      UrlScanData: entry.UrlScanData || null,
    });
    onSelectHistory?.({
      ScanningData: entry.ScanningData || null,
      SandboxData: entry.SandboxData || null,
      UrlScanData: entry.UrlScanData || null,
    });
  };

  const handleClearScanHistory = () => {
    localStorage.removeItem("scanHistory");
    setScanHistory([]);
  };

  const handleClearChatHistory = () => {
    localStorage.removeItem("chatHistories");
    setSavedChatHistories([]);
  };

  const handleSaveChatHistory = () => {
    if (chatHistory.length === 0) return;

    const timestamp = new Date().toLocaleString();
    const newEntry = {
      id: Date.now(),
      timestamp,
      messages: chatHistory,
      ScanningData: ScanningData || null,
      SandboxData: SandboxData || null,
      UrlScanData: UrlScanData || null,
    };

    setSavedChatHistories((prev) => {
      const updated = [...prev, newEntry];
      localStorage.setItem("chatHistories", JSON.stringify(updated));
      return updated;
    });

    setChatHistory([]);
    setLocalData({});
    onSelectHistory?.({});
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
      return {
        name: entry.displayName || "Unknown File",
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
      return {
        name: entry.displayName || "Unknown URL",
        verdict,
        color,
      };
    }
    return { name: "Unknown", verdict: "No verdict available", color: "default" };
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
              schedule
            </button>
            <button onClick={handleSaveChatHistory} className="material-symbols-rounded">
              refresh
            </button>
            <button
              onClick={() => {
                setShowChatbot(false);
                setShowScanDropdown(false);
                setShowChatHistoryDropdown(false);
              }}
              className="material-symbols-rounded"
            >
              keyboard_arrow_down
            </button>
          </div>
        </div>

        {showScanDropdown && (
          <div className="history-dropdown scan-history-dropdown">
            <button
              onClick={handleClearScanHistory}
              className="clear-history-button"
            >
              Clear
            </button>
            {scanHistory.length === 0 && <p className="history-empty">No saved scans.</p>}
            {scanHistory.length > 0 && (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>SCAN TIME</th>
                    <th>VERDICT</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((entry) => {
                    const { name, verdict, color } = getDisplayInfo(entry);
                    return (
                      <tr
                        key={entry.id}
                        className="history-entry"
                        onClick={() => handleSelectScanHistory(entry)}
                      >
                        <td title={name} className={`history-cell-${color}`}>
                          {name}
                        </td>
                        <td title={entry.timestamp || "N/A"}>{entry.timestamp || "N/A"}</td>
                        <td title={verdict} className={`history-cell-${color}`}>
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
          <div className="history-dropdown chat-history-dropdown">
            <button
              onClick={handleClearChatHistory}
              className="clear-history-button"
            >
              Clear
            </button>
            {savedChatHistories.length === 0 && <p className="history-empty">No saved chats.</p>}
            {savedChatHistories.length > 0 && (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>TIMESTAMP</th>
                    <th>MESSAGES</th>
                  </tr>
                </thead>
                <tbody>
                  {savedChatHistories.map((entry) => (
                    <tr
                      key={entry.id}
                      className="history-entry"
                      onClick={() => handleSelectChatHistory(entry)}
                    >
                      <td title={entry.timestamp || "N/A"}>{entry.timestamp || "N/A"}</td>
                      <td>
                        {entry.messages.slice(-1)[0]?.text?.substring(0, 50) || "No messages"}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div ref={chatBodyRef} className="chat-body">
          <div className="message bot-message">
            <ChatbotIcon />
            <p className="message-text">
              Hey there 👋 <br /> How can I help you today?
            </p>
          </div>
          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} />
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