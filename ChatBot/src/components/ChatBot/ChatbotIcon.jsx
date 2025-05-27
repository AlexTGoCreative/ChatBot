import React from 'react';

const ChatbotIcon = ({ onClick }) => {
  return (
    <img
      src="https://files.bpcontent.cloud/2025/02/17/06/20250217065750-MNKY40ML.webp"
      alt="Ozzy Chatbot"
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