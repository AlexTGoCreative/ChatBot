import ChatbotIcon from "./ChatbotIcon";
import InitialMessage from "./InitialMessage";

const ChatMessage = ({ chat, isFirstMessage }) => {
  if (isFirstMessage && chat.role === "model") {
    return <InitialMessage />;
  }

  return (
    !chat.hideInChat && (
      <div className={`message ${chat.role === "model" ? "bot" : "user"}-message ${chat.isError ? "error" : ""}`}>
        {chat.role === "model" && <ChatbotIcon />}
        <p className="message-text">{chat.text}</p>
      </div>
    )
  );
};

export default ChatMessage;
