import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const navItems = [
  { label: "Início", path: "/inicio", enabled: true },
  { label: "Videoaulas", path: "/videoaulas", enabled: true },
  { label: "BioO3 Lab", path: "/bioo3-lab", enabled: true },
  { label: "Pacientes", path: "/pacientes", enabled: true },
  { label: "Estoque", path: "/estoque", enabled: true },
  { label: "Agenda", path: "/agenda", enabled: true }
];

export default function Topbar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const profileImage = user?.profileImagePath || "/assets/user-icon.png";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="topbar">
      <div className="topbar-brand-group">
        <NavLink to="/inicio" className="brand" aria-label="BioO3 Início">
          <img src="/assets/logo.svg" alt="BioO3" />
        </NavLink>
        <div className="brand-copy">
          <span>BioO3</span>
        </div>
      </div>

      <nav className="topnav" aria-label="Navegação principal">
        {navItems.map((item) => (
          item.enabled ? (
            <NavLink key={item.label} to={item.path}>{item.label}</NavLink>
          ) : (
            <span key={item.label} className="nav-disabled" title="Será implementado nas próximas etapas">
              {item.label}
            </span>
          )
        ))}
      </nav>

      <div className="top-actions">
        <NavLink to="/account" className="avatar-link" aria-label="Minha conta">
          <img src={profileImage} alt="Minha conta" />
        </NavLink>
        <button className="ghost-button" type="button" onClick={handleLogout}>Sair</button>
      </div>
    </header>
  );
}
