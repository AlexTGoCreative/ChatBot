import './Navbar.css';

export default function Navbar({ onOpenSettings, onLogout }) {
  return (
    <header className="ozzy-nav">
      <div className="ozzy-nav-inner">
        <div className="ozzy-nav-brand">
          <img
            className="ozzy-nav-logo"
            src="https://static.opswat.com/assets/images/ozzy.gif"
            alt=""
            aria-hidden="true"
          />
          <span className="ozzy-nav-name">Ozzy</span>
        </div>

        <nav className="ozzy-nav-actions">
          <button type="button" className="ozzy-nav-link" onClick={onOpenSettings}>
            Settings
          </button>
          <button type="button" className="ozzy-nav-cta" onClick={onLogout}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
