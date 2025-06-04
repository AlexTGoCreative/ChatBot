import React from 'react';
import './InitialMessage.css';

const InitialMessage = () => {
  return (
    <div className="initial-message">
      <img 
        src="https://static.opswat.com/assets/images/ozzy.gif"
        alt="Ozzy"
        className="ozzy-icon"
      />
      <div className="message-content">
        <h3 className="message-title">Hey there!</h3>
        <p className="message-text">
          I'm Ozzy, your OPSWAT AI Assisstant. I can help you with Metadefender Cloud questions
        </p>
      </div>
    </div>
  );
};

export default InitialMessage; 