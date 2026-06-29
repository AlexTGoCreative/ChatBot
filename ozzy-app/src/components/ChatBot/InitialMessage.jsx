import React from 'react';
import './InitialMessage.css';

const InitialMessage = () => {
  return (
    <div className="initial-message">
      <img 
        src="/agatha-icon.png"
        alt="Athena"
        className="ozzy-icon"
      />
      <div className="message-content">
        <h3 className="message-title">Hey there!</h3>
        <p className="message-text">
          I'm Athena, your AI security assistant. Ask me about your scan results, what a verdict means, or anything about MetaDefender and the Agatha engine.
        </p>
      </div>
    </div>
  );
};

export default InitialMessage; 