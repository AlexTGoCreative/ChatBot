import { useEffect, useRef, useState } from "react";
import ChatbotIcon from "./ChatbotIcon";
import ChatForm from "./ChatForm";
import ChatMessage from "./ChatMessage";
import "./Chatbot.css";

const Chatbot = ({ Data }) => {
  const chatBodyRef = useRef();
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const { ScanningData, SandboxData, UrlScanData } = Data || {};

  const scanCompleted = ScanningData?.scan_results?.progress_percentage === 100;

  useEffect(() => {
    if (scanCompleted) {
      setChatHistory((prev) => {
        const alreadyAdded = prev.some((msg) => msg.text === "Fișierul a fost scanat cu succes.");
        if (!alreadyAdded) {
          return [...prev, { role: "model", text: "Fișierul a fost scanat cu succes." }];
        }
        return prev;
      });
    }
  }, [scanCompleted]);

  const generateBotResponse = async (history) => {
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text, isError },
      ]);
    };

    console.log("date scanate:    ", ScanningData);
    console.log("Sandbox data", SandboxData);
    console.log("Url", UrlScanData)

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
            <ChatbotIcon />
            <h2 className="logo-text">Benny</h2>
          </div>
          <div className="header-buttons">
            <button onClick={() => setChatHistory([])} className="material-symbols-rounded">
              refresh
            </button>
            <button onClick={() => setShowChatbot((prev) => !prev)} className="material-symbols-rounded">
              keyboard_arrow_down
            </button>
          </div>
        </div>

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
