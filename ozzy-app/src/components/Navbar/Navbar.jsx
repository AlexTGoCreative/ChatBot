import './Navbar.css';

export default function Navbar({ onOpenSettings, onOpenLogs, onLogout, scanMode }) {
  const displayName = scanMode === 'url' ? 'Aegis' : 'Agatha';
  return (
    <header className="ozzy-nav">
      <div className="ozzy-nav-inner">
        <div className="ozzy-nav-brand">
          <img
            className="ozzy-nav-logo"
            src="/agatha-icon.png"
            alt=""
            aria-hidden="true"
          />
          <span className="ozzy-nav-name">{displayName}</span>
        </div>

        <nav className="ozzy-nav-actions">
          {/* Shown on the results page — opens the agatha engine diagnostics
              (feature vector, scan layers, verdict, scored deepscan URLs). */}
          {onOpenLogs && (
            <button type="button" className="ozzy-nav-link" onClick={onOpenLogs}>
              Logs
            </button>
          )}
          {scanMode !== 'url' && (
            <button type="button" className="ozzy-nav-link" onClick={onOpenSettings}>
              Settings
            </button>
          )}
          <button type="button" className="ozzy-nav-cta" onClick={onLogout}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
