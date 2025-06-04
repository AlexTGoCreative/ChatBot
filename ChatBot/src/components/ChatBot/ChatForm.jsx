import { useRef } from "react";

const ChatForm = ({ chatHistory, setChatHistory, generateBotResponse }) => {
  const inputRef = useRef();

  const TypingAnimation = () => (
    <div className="typing-animation">
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
      <div className="typing-dot"></div>
    </div>
  );

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage) return;
    inputRef.current.value = "";

    setChatHistory((history) => [...history, { role: "user", text: userMessage }]);

    setTimeout(() => {
      setChatHistory((history) => [...history, { role: "model", text: <TypingAnimation /> }]);

      generateBotResponse([...chatHistory, { role: "user", text: userMessage }]);
    }, 600);
  };

  return (
    <form onSubmit={handleFormSubmit} className="chat-form">
      <input ref={inputRef} placeholder="Message..." className="message-input" required />
      <button type="submit" id="send-message" className="material-symbols-rounded">
        arrow_upward
      </button>
    </form>
  );
};

export default ChatForm;
