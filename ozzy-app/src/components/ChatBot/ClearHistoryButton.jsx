import { useState } from "react";

// Destructive "clear all history" control with an inline two-step confirm so a
// single tap can't wipe a user's saved scans/chats. Lives in the pinned panel
// footer; resets to its idle state on cancel or after the action runs.
const ClearHistoryButton = ({ onClear, label = "Clear history" }) => {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="history-confirm">
        <span className="history-confirm-text">Clear all history?</span>
        <button
          type="button"
          className="history-btn history-btn-ghost"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="history-btn history-btn-danger"
          onClick={() => {
            onClear();
            setConfirming(false);
          }}
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="history-btn history-btn-clear"
      onClick={() => setConfirming(true)}
    >
      <span className="material-symbols-rounded">delete</span>
      {label}
    </button>
  );
};

export default ClearHistoryButton;
