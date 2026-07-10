import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { TableSkeleton } from "../components/Skeleton";

const statusLabels = { PENDING: "Pendente", ACTIVE: "Ativa", REJECTED: "Rejeitada", SUSPENDED: "Suspensa" };

export default function ClinicsPage() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  function load(status = filter) {
    setError("");
    setLoading(true);
    return api.clinics(status)
      .then((data) => setClinics(data.clinics || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(""); }, []);
  if (user?.role !== "ADMIN") return <Navigate to="/inicio" replace />;

  async function act(action, success) {
    setError(""); setMessage("");
    try { await action(); setMessage(success); await load(); }
    catch (err) { setError(err.message); }
  }

  function reject(clinic) {
    const reason = window.prompt("Informe o motivo da rejeição:");
    if (reason?.trim()) act(() => api.rejectClinic(clinic.id, reason.trim()), "Solicitação rejeitada.");
  }
  function changeEmail(clinic) {
    const email = window.prompt("Novo e-mail de acesso:", clinic.user?.email || "");
    if (email?.trim()) act(() => api.setClinicEmail(clinic.id, email.trim()), "E-mail atualizado.");
  }

  return <div className="app-frame"><main className="page-shell">
    <section className="page-heading"><div><p className="eyebrow">Administração</p><h1>Clínicas</h1><p className="page-subtitle">Aprovação e controle dos acessos das clínicas.</p></div></section>
    <section className="panel">
      <form className="filter-bar" onSubmit={(e) => { e.preventDefault(); load(); }}><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="secondary-button">Filtrar</button></form>
      {error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}
      {loading && <TableSkeleton columns={5} rows={5} />}
      {!loading && <div className="table-wrap"><table className="control-table clinics-table"><thead><tr><th>Clínica</th><th>E-mail</th><th>Status</th><th>Motivo da rejeição</th><th>Ações</th></tr></thead><tbody>
        {clinics.map((clinic) => <tr key={clinic.id}><td>{clinic.name}</td><td>{clinic.user?.email || "—"}</td><td><span className={`status-pill ${clinic.status === "ACTIVE" ? "active" : "muted"}`}>{statusLabels[clinic.status]}</span></td><td>{clinic.rejectionReason || "—"}</td><td><div className="row-actions">
          {clinic.status === "PENDING" && <><button className="primary-button compact-button" onClick={() => act(() => api.approveClinic(clinic.id), "Clínica aprovada.")}>Aprovar</button><button className="danger-button compact-button" onClick={() => reject(clinic)}>Rejeitar</button></>}
          {clinic.status === "ACTIVE" && <button className="secondary-button compact-button" onClick={() => act(() => api.setClinicStatus(clinic.id, "SUSPENDED"), "Clínica suspensa.")}>Suspender</button>}
          {clinic.status === "SUSPENDED" && <button className="primary-button compact-button" onClick={() => act(() => api.setClinicStatus(clinic.id, "ACTIVE"), "Clínica reativada.")}>Reativar</button>}
          {clinic.user && <button className="secondary-button compact-button" onClick={() => changeEmail(clinic)}>Alterar e-mail</button>}
        </div></td></tr>)}
        {!clinics.length && <tr><td colSpan="5"><div className="empty-state compact-empty">Nenhuma clínica encontrada.</div></td></tr>}
      </tbody></table></div>}
    </section>
  </main></div>;
}
