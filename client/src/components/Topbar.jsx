import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";

const navItems = [
  { label: "Início", path: "/inicio", enabled: true },
  { label: "Videoaulas", path: "/videoaulas", enabled: true },
  { label: "BioO3 Lab", path: "/bioo3-lab", enabled: true },
  { label: "Pacientes", path: "/pacientes", enabled: true },
  { label: "Estoque", path: "/estoque", enabled: true },
  { label: "Agenda", path: "/agenda", enabled: true },
  { label: "Clínicas", path: "/admin/clinics", enabled: true, adminOnly: true, className: "clinics-nav-link" }
];

export default function Topbar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const profileImage = user?.profileImagePath || "/assets/user-icon.png";
  const [clinics, setClinics] = useState([]);
  const [scope, setScope] = useState(localStorage.getItem("bioo3_clinic_scope") || "");

  useEffect(() => {
    if (user?.role === "ADMIN") api.clinics().then((data) => setClinics((data.clinics || []).filter((clinic) => clinic.status === "ACTIVE"))).catch(() => {});
  }, [user?.role]);

  function changeScope(event) {
    const value = event.target.value; setScope(value); api.setClinicScope(value); window.location.reload();
  }

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
        {navItems.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((item) => (
          item.enabled ? (
            <NavLink key={item.label} to={item.path} className={item.className}>{item.label}</NavLink>
          ) : (
            <span key={item.label} className="nav-disabled" title="Será implementado nas próximas etapas">
              {item.label}
            </span>
          )
        ))}
      </nav>

      <div className="top-actions">
        {user?.role === "ADMIN" && <select className="clinic-selector" value={scope} onChange={changeScope} aria-label="Filtrar por clínica"><option value="">Todas as clínicas</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select>}
        <NavLink to="/account" className="avatar-link" aria-label="Minha conta">
          <img src={profileImage} alt="Minha conta" />
        </NavLink>
        <button className="ghost-button" type="button" onClick={handleLogout}>Sair</button>
      </div>
    </header>
  );
}
