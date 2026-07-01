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
          I'm Athena, the Triple A security assistant. Ask me about your scan results, what a verdict means, or how Agatha and Aegis work.
        </p>
      </div>
    </div>
  );
};

export default InitialMessage; 