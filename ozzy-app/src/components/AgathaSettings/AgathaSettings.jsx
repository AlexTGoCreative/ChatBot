import React, { useState } from 'react';
import './AgathaSettings.css';

const DEFAULT_SETTINGS = {
  enabled: false,
};

export default function AgathaSettings({ settings, onSettingsChange, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings || DEFAULT_SETTINGS);

  const handleToggle = (key) => {
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  return (
    <div className="agatha-settings-overlay" onClick={onClose}>
      <div className="agatha-settings-popup" onClick={e => e.stopPropagation()}>
        <div className="agatha-settings-header">
          <div className="agatha-header-left">
            <span className="agatha-icon">🧠</span>
            <h2>Agatha Detection AI</h2>
          </div>
          <button className="agatha-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="agatha-settings-body">
          {/* Enable/Disable Toggle */}
          <div className="agatha-setting-group">
            <div className="agatha-toggle-row">
              <div className="agatha-toggle-info">
                <span className="agatha-setting-label">Enable Engine</span>
                <span className="agatha-setting-desc">
                  Run Agatha AI detection engine alongside MetaDefender multiscanning
                </span>
              </div>
              <label className="agatha-switch">
                <input
                  type="checkbox"
                  checked={localSettings.enabled}
                  onChange={() => handleToggle('enabled')}
                />
                <span className="agatha-slider"></span>
              </label>
            </div>
          </div>

          {localSettings.enabled && (
            <div className="agatha-setting-group">
              <span className="agatha-setting-label">Detection Mode</span>
              <span className="agatha-setting-desc">
                The engine classifies files as <strong>Clean</strong> or <strong>Infected</strong> using 
                ONNX ML models. Supports PE, ELF, Mach-O, PDF, OOXML, and image file types.
              </span>
            </div>
          )}
        </div>

        <div className="agatha-settings-footer">
          <button className="agatha-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="agatha-btn-save" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_SETTINGS };
