import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChatbotIcon from "./ChatbotIcon";
import InitialMessage from "./InitialMessage";

const ChatMessage = ({ chat, isFirstMessage }) => {
  if (isFirstMessage && chat.role === "model") {
    return <InitialMessage />;
  }

  // Only the bot's text answers are markdown — user input is shown verbatim, and
  // chat.text can also be a React node (e.g. the typing animation placeholder).
  const renderAsMarkdown = chat.role === "model" && typeof chat.text === "string";

  return (
    !chat.hideInChat && (
      <div className={`message ${chat.role === "model" ? "bot" : "user"}-message ${chat.isError ? "error" : ""}`}>
        {chat.role === "model" && <ChatbotIcon />}
        <div className={`message-text ${renderAsMarkdown ? "markdown-body" : ""}`}>
          {renderAsMarkdown ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {chat.text}
            </ReactMarkdown>
          ) : (
            chat.text
          )}
        </div>
      </div>
    )
  );
};

export default ChatMessage;
