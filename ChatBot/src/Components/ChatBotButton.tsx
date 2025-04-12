import { useState } from 'react';
import ChatPopup from './ChatBotWindow';
import ChatIcon from '../assets/ChatIcon.png';
import './ChatBotButton.css';

const ChatBotButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  return (
    <>
      {!isChatOpen && (
        <button className="chat-button" onClick={toggleChat}>
          <img src={ChatIcon} alt="Chat Icon" className="chat-icon" />
        </button>
      )}
      {isChatOpen && <ChatPopup onClose={toggleChat} />}
    </>
  );
};

export default ChatBotButton;
