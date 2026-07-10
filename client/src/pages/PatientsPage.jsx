import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { TableSkeleton } from "../components/Skeleton";
import Topbar from "../components/Topbar";

const emptyPatient = {
  name: "",
  age: "",
  cpf: "",
  gender: "",
  phone: "",
  doctorId: "",
  prescription: ""
};

function PatientForm({ doctors, form, setForm, onSubmit, submitLabel, error }) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label><span>Nome</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label><span>Idade</span><input type="number" min="0" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required /></label>
      <label><span>CPF</span><input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></label>
      <label><span>Sexo</span><input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></label>
      <label><span>Telefone</span><input inputMode="numeric" maxLength="11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} /></label>
      <label><span>Médico</span><select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
        <option value="">Selecione o médico</option>
        {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}{doctor.clinic?.name ? ` · ${doctor.clinic.name}` : ""}</option>)}
      </select></label>
      <label className="full-width"><span>Prescrição inicial (opcional)</span><textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} rows="7" /></label>
      {error && <p className="form-error full-width">{error}</p>}
      <button className="primary-button fit-button" type="submit">{submitLabel}</button>
    </form>
  );
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [patientForm, setPatientForm] = useState(emptyPatient);

  function loadPatients(filters = { search, status }) {
    setLoading(true);
    setError("");
    return api.patients(filters)
      .then((data) => {
        setPatients(data.patients || []);
        setSelectedPatientIds([]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPatients({ search: "", status: "" });
    api.doctors().then((data) => setDoctors(data.doctors || [])).catch(() => setDoctors([]));
  }, []);

  function openCreate() {
    setPatientForm(emptyPatient);
    setFormError("");
    setIsCreateOpen(true);
  }

  function openProntuario(patientId) {
    navigate(`/pacientes/${patientId}`);
  }

  function handleFilter(event) {
    event.preventDefault();
    loadPatients({ search, status });
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError("");
    try {
      const data = await api.createPatient(patientForm);
      setIsCreateOpen(false);
      setPatientForm(emptyPatient);
      await loadPatients();
      navigate(`/pacientes/${data.patient.id}`);
    } catch (err) {
      setFormError(err.message);
    }
  }

  function togglePatientSelection(id) {
    setSelectedPatientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllPatients() {
    setSelectedPatientIds((current) => current.length === patients.length ? [] : patients.map((patient) => patient.id));
  }

  function deleteSelectedPatients() {
    if (!selectedPatientIds.length || !window.confirm(`Remover ${selectedPatientIds.length} paciente(s) selecionado(s)?`)) return;
    api.deletePatients(selectedPatientIds).then(() => loadPatients()).catch((err) => setError(err.message));
  }

  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div><p className="eyebrow">Pacientes</p><h1>Catálogo de pacientes</h1><p className="page-subtitle">Abra o prontuário para consultar e editar cada paciente.</p></div>
          <button className="primary-button" type="button" onClick={openCreate}>Cadastrar paciente</button>
        </section>

        <section className="panel">
          <form className="filter-bar" onSubmit={handleFilter}>
            <input type="search" placeholder="Pesquisar paciente..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select>
            <button className="secondary-button" type="submit">Filtrar</button>
          </form>
          <div className="bulk-actions"><span>{selectedPatientIds.length} selecionado(s)</span><button className="danger-button" type="button" onClick={deleteSelectedPatients} disabled={!selectedPatientIds.length}>Apagar selecionados</button></div>
          {error && <p className="form-error">{error}</p>}
          {loading && <TableSkeleton columns={7} />}
          {!loading && !error && <div className="table-wrap">
            <table className="control-table patients-table">
              <thead><tr><th className="center"><input type="checkbox" checked={patients.length > 0 && selectedPatientIds.length === patients.length} onChange={toggleAllPatients} aria-label="Selecionar todos os pacientes" /></th><th>Paciente</th><th>Clínica</th><th>Telefone</th><th>Médico</th><th>Status</th><th className="center">Ações</th></tr></thead>
              <tbody>
                {patients.map((patient) => <tr key={patient.id}>
                  <td className="center"><input type="checkbox" checked={selectedPatientIds.includes(patient.id)} onChange={() => togglePatientSelection(patient.id)} aria-label={`Selecionar ${patient.name}`} /></td>
                  <td><button className="patient-name-button" type="button" onClick={() => openProntuario(patient.id)}>{patient.name}</button></td>
                  <td>{patient.clinicName || "—"}</td><td>{patient.phone || "Não informado"}</td><td>{patient.doctorName}</td>
                  <td><span className={`status-pill ${patient.status === "Ativo" ? "active" : "muted"}`}>{patient.status}</span></td>
                  <td className="center"><button className="secondary-button compact-button" type="button" onClick={() => openProntuario(patient.id)}>Prontuário</button></td>
                </tr>)}
                {!patients.length && <tr><td colSpan="7"><div className="empty-state compact-empty">Nenhum paciente encontrado.</div></td></tr>}
              </tbody>
            </table>
          </div>}
        </section>
      </main>

      {isCreateOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-patient-title"><div className="modal-card">
        <button className="modal-close" type="button" onClick={() => setIsCreateOpen(false)} aria-label="Fechar">×</button>
        <h2 id="new-patient-title">Novo paciente</h2>
        <PatientForm doctors={doctors} form={patientForm} setForm={setPatientForm} onSubmit={handleCreate} submitLabel="Salvar paciente" error={formError} />
      </div></div>}
    </div>
  );
}
