import React from 'react';
import './LoadingOverlay.css';

const LoadingOverlay = ({
  isVisible,
  status, // 'scanning', 'success', 'error'
  message,
  onRetry,
  onClose,
  scanType // 'file' or 'url'
}) => {
  if (!isVisible) return null;

  const getIcon = () => {
    switch (status) {
      case 'scanning':
        return <div className="loading-spinner" />;
      case 'success':
        return <div className="success-checkmark">✓</div>;
      case 'error':
        return <div className="error-icon">⚠</div>;
      default:
        return <div className="loading-spinner" />;
    }
  };

  const getMessage = () => {
    if (message) return message;

    switch (status) {
      case 'scanning':
        return scanType === 'file'
          ? 'Scanning file...'
          : 'Processing URL...';
      case 'success':
        return 'Scan completed successfully!';
      case 'error':
        return 'Scan failed. Please try again.';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        {status === 'error' && onClose && (
          <button className="loading-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
        <div className="loading-icon">
          {getIcon()}
        </div>
        <div className="loading-message">
          {getMessage()}
        </div>
        {status === 'error' && onRetry && (
          <div className="loading-actions">
            <button className="retry-button" onClick={onRetry}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
