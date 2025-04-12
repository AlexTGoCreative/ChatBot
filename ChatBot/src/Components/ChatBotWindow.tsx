import './ChatBotWindow.css';
import ChatIcon from '../assets/ChatIcon.png'; 

interface ChatPopupProps {
  onClose: () => void;
}

const ChatBotWindow: React.FC<ChatPopupProps> = ({ onClose }) => {
  return (
    <div className="chat-popup">
      <div className="chat-header">
        <div className="chat-header-title">
          <img src={ChatIcon} alt="Chat Icon" className="chat-header-icon" />
          <span className="chat-header-name">Benny</span>
        </div>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="chat-body">
        <p>Welcome to the chatbot! This is a placeholder.</p>
      </div>
      <div className="chat-footer">
        <input type="text" placeholder="Type a message..." />
        <button>Send</button>
      </div>
    </div>
  );
};

export default ChatBotWindow;
