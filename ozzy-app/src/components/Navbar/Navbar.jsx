import './Navbar.css';

export default function Navbar({ onOpenSettings, onOpenLogs, onLogout, scanMode, theme, onToggleTheme }) {
  const displayName = scanMode === 'url' ? 'Aegis' : 'Argus';
  return (
    <header className="ozzy-nav">
      <div className="ozzy-nav-inner">
        <button
          type="button"
          className="ozzy-nav-brand"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <img
            className="ozzy-nav-logo"
            src="/argus-icon.png"
            alt=""
            aria-hidden="true"
          />
          <span className="ozzy-nav-name">{displayName}</span>
        </button>

        <nav className="ozzy-nav-actions">
          {/* Shown on the results page — opens the argus engine diagnostics
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
