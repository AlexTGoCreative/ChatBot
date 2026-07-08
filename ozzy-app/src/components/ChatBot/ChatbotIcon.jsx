import React from 'react';

const ChatbotIcon = ({ onClick }) => {
  return (
    <img
      src="/argus-icon.png"
      alt="Athena Chatbot"
      width="25"
      height="25"
      onClick={onClick}
      style={{ 
        cursor: 'pointer',
        borderRadius: '50%' 
      }}
    />
  );
};

export default ChatbotIcon;