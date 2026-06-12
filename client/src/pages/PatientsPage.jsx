import { useEffect, useState } from "react";
import { api } from "../api";
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

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function patientToForm(patient) {
  return {
    name: patient.name || "",
    age: patient.age || "",
    cpf: patient.cpf || "",
    gender: patient.gender || "",
    phone: patient.phone || "",
    doctorId: patient.doctorId || "",
    prescription: patient.prescription || ""
  };
}

function normalizeForm(form) {
  return {
    name: String(form.name || "").trim(),
    age: String(form.age || "").trim(),
    cpf: String(form.cpf || "").trim(),
    gender: String(form.gender || "").trim(),
    phone: String(form.phone || "").trim(),
    doctorId: String(form.doctorId || "").trim(),
    prescription: String(form.prescription || "").trim()
  };
}

function PatientForm({ doctors, form, setForm, onSubmit, submitLabel, error, hideSubmit = false }) {
  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label>
        <span>Nome</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </label>
      <label>
        <span>Idade</span>
        <input type="number" min="0" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required />
      </label>
      <label>
        <span>CPF</span>
        <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
      </label>
      <label>
        <span>Sexo</span>
        <input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
      </label>
      <label>
        <span>Telefone</span>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </label>
      <label>
        <span>Médico</span>
        <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
          <option value="">Selecione o médico</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
          ))}
        </select>
      </label>
      <label className="full-width">
        <span>Prescrição</span>
        <textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} rows="7" />
      </label>
      {error && <p className="form-error full-width">{error}</p>}
      {!hideSubmit && <button className="primary-button fit-button" type="submit">{submitLabel}</button>}
    </form>
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [consultationText, setConsultationText] = useState("");

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

  function openCreateModal() {
    setPatientForm(emptyPatient);
    setFormError("");
    setIsCreateOpen(true);
  }

  function openDetails(patientId) {
    setFormError("");
    setConsultationText("");
    api.patient(patientId)
      .then((data) => {
        const patient = data.patient;
        setSelectedPatient(patient);
        setPatientForm(patientToForm(patient));
      })
      .catch((err) => setError(err.message));
  }

  function handleFilter(event) {
    event.preventDefault();
    loadPatients({ search, status });
  }

  function handleCreate(event) {
    event.preventDefault();
    setFormError("");
    api.createPatient(patientForm)
      .then(() => {
        setIsCreateOpen(false);
        setPatientForm(emptyPatient);
        return loadPatients();
      })
      .catch((err) => setFormError(err.message));
  }

  function handleUpdate(event) {
    event?.preventDefault();
    if (!selectedPatient) return;
    setFormError("");
    api.updatePatient(selectedPatient.id, patientForm)
      .then((data) => {
        setSelectedPatient(data.patient);
        setPatientForm(patientToForm(data.patient));
        return loadPatients();
      })
      .catch((err) => setFormError(err.message));
  }

  function hasUnsavedPatientChanges() {
    if (!selectedPatient) return false;
    return JSON.stringify(normalizeForm(patientForm)) !== JSON.stringify(normalizeForm(patientToForm(selectedPatient)));
  }

  function closeDetailsModal() {
    if (hasUnsavedPatientChanges() && !window.confirm("Existem alterações não salvas. Deseja sair sem salvar?")) {
      return;
    }
    setSelectedPatient(null);
    setFormError("");
    setConsultationText("");
  }

  function toggleStatus(patient) {
    const nextStatus = patient.status === "Ativo" ? "Inativo" : "Ativo";
    api.updatePatientStatus(patient.id, nextStatus)
      .then(() => loadPatients())
      .catch((err) => setError(err.message));
  }

  function togglePatientSelection(id) {
    setSelectedPatientIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleAllPatients() {
    setSelectedPatientIds((current) => (
      current.length === patients.length ? [] : patients.map((patient) => patient.id)
    ));
  }

  function deleteSelectedPatients() {
    if (!selectedPatientIds.length) return;
    if (!window.confirm(`Remover ${selectedPatientIds.length} paciente(s) selecionado(s)?`)) return;
    api.deletePatients(selectedPatientIds)
      .then(() => loadPatients())
      .catch((err) => setError(err.message));
  }

  function deletePatient() {
    if (!selectedPatient || !window.confirm("Deseja realmente remover este paciente?")) return;
    api.deletePatient(selectedPatient.id)
      .then(() => {
        setSelectedPatient(null);
        return loadPatients();
      })
      .catch((err) => setFormError(err.message));
  }

  function addConsultation(event) {
    event.preventDefault();
    if (!selectedPatient || !consultationText.trim()) return;
    api.createConsultation(selectedPatient.id, { notes: consultationText })
      .then(() => api.patient(selectedPatient.id))
      .then((data) => {
        setSelectedPatient(data.patient);
        setConsultationText("");
      })
      .catch((err) => setFormError(err.message));
  }

  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Pacientes</p>
            <h1>Catálogo de pacientes</h1>
            <p className="page-subtitle">Cadastro, status e histórico clínico.</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreateModal}>Cadastrar paciente</button>
        </section>

        <section className="panel">
          <form className="filter-bar" onSubmit={handleFilter}>
            <input
              type="search"
              placeholder="Pesquisar paciente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
            <button className="secondary-button" type="submit">Filtrar</button>
          </form>
          <div className="bulk-actions">
            <span>{selectedPatientIds.length} selecionado(s)</span>
            <button className="danger-button" type="button" onClick={deleteSelectedPatients} disabled={!selectedPatientIds.length}>
              Apagar selecionados
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading && <div className="empty-state">Carregando pacientes...</div>}
          {!loading && !error && (
            <div className="table-wrap">
              <table className="control-table patients-table">
                <colgroup>
                  <col className="patient-col-select" />
                  <col className="patient-col-name" />
                  <col className="patient-col-phone" />
                  <col className="patient-col-doctor" />
                  <col className="patient-col-status" />
                  <col className="patient-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="center">
                      <input
                        type="checkbox"
                        checked={patients.length > 0 && selectedPatientIds.length === patients.length}
                        onChange={toggleAllPatients}
                        aria-label="Selecionar todos os pacientes"
                      />
                    </th>
                    <th>Paciente</th>
                    <th>Telefone</th>
                    <th>Médico</th>
                    <th>Status</th>
                    <th className="center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={selectedPatientIds.includes(patient.id)}
                          onChange={() => togglePatientSelection(patient.id)}
                          aria-label={`Selecionar ${patient.name}`}
                        />
                      </td>
                      <td>
                        <button className="patient-name-button" type="button" onClick={() => openDetails(patient.id)}>
                          {patient.name}
                        </button>
                      </td>
                      <td>{patient.phone || "Não informado"}</td>
                      <td>{patient.doctorName}</td>
                      <td>
                        <button
                          className={`status-pill ${patient.status === "Ativo" ? "active" : "muted"}`}
                          type="button"
                          onClick={() => toggleStatus(patient)}
                        >
                          {patient.status}
                        </button>
                      </td>
                      <td className="center">
                        <button className="secondary-button compact-button" type="button" onClick={() => openDetails(patient.id)}>
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!patients.length && (
                    <tr>
                      <td colSpan="6"><div className="empty-state compact-empty">Nenhum paciente encontrado.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={() => setIsCreateOpen(false)}>×</button>
            <h2>Novo paciente</h2>
            <PatientForm
              doctors={doctors}
              form={patientForm}
              setForm={setPatientForm}
              onSubmit={handleCreate}
              submitLabel="Salvar paciente"
              error={formError}
            />
          </div>
        </div>
      )}

      {selectedPatient && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card patient-detail-modal">
            <button className="modal-close" type="button" onClick={closeDetailsModal}>×</button>
            <div className="patient-modal-scroll">
              <div className="modal-title-row">
                <div>
                  <p className="eyebrow modal-eyebrow">Paciente</p>
                  <h2>{selectedPatient.name}</h2>
                </div>
                <span className={`status-pill ${selectedPatient.status === "Ativo" ? "active" : "muted"}`}>
                  {selectedPatient.status}
                </span>
              </div>

              <div className="detail-grid">
                <div><span>Cadastro</span><strong>{formatDate(selectedPatient.createdAt)}</strong></div>
                <div><span>Médico</span><strong>{selectedPatient.doctorName}</strong></div>
                <div><span>CPF</span><strong>{selectedPatient.cpf || "Não informado"}</strong></div>
                <div><span>Telefone</span><strong>{selectedPatient.phone || "Não informado"}</strong></div>
              </div>

              <PatientForm
                doctors={doctors}
                form={patientForm}
                setForm={setPatientForm}
                onSubmit={handleUpdate}
                submitLabel="Salvar alterações"
                error={formError}
                hideSubmit
              />

              <form className="consultation-form" onSubmit={addConsultation}>
                <label>
                  <span>Adicionar consulta</span>
                  <textarea
                    value={consultationText}
                    onChange={(event) => setConsultationText(event.target.value)}
                    placeholder="Observações da consulta"
                    rows="4"
                  />
                </label>
                <button className="secondary-button fit-button" type="submit">Adicionar consulta</button>
              </form>

              <div className="consultation-list">
                <h3>Histórico</h3>
                {selectedPatient.consultations?.map((consultation) => (
                  <article key={consultation.id} className="consultation-card">
                    <time>{formatDate(consultation.createdAt)}</time>
                    <pre>{consultation.notes}</pre>
                  </article>
                ))}
                {!selectedPatient.consultations?.length && <p className="muted-text">Nenhuma consulta registrada.</p>}
              </div>
            </div>

            <div className="patient-modal-footer">
              <button className="danger-button" type="button" onClick={deletePatient}>Remover paciente</button>
              <button className="primary-button" type="button" onClick={handleUpdate} disabled={!hasUnsavedPatientChanges()}>
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
