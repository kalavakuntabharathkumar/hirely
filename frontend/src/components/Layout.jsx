import { NavLink } from "react-router-dom";
import { useAuth } from "../useAuth.jsx";
import Button from "./Button.jsx";

const NAV = [
  ["/", "Dashboard", "▦"],
  ["/candidates", "Candidates", "☰"],
  ["/board", "Board", "▥"],
];

// Sidebar on desktop, bottom bar on phones (the switch is pure CSS).
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <span className="brand topbar-brand">Hirely</span>
        <div className="topbar-user">
          <span>{user.name}</span>
          <Button variant="ghost" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>
      <nav className="nav" aria-label="Main">
        <span className="brand nav-brand">Hirely</span>
        {NAV.map(([to, label, glyph]) => (
          <NavLink key={to} to={to} end={to === "/"} className="nav-link">
            <span className="nav-glyph" aria-hidden="true">
              {glyph}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}
