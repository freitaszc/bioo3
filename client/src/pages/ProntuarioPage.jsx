import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import Topbar from "../components/Topbar";
import { TableSkeleton } from "../components/Skeleton";

const frequencyLabels = { WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal" };
const routeLabels = { INTRAMUSCULAR: "Intramuscular", INTRAVENOUS: "Endovenosa", SUBCUTANEOUS: "Subcutânea" };
const planStatusLabels = { QUOTE: "Orçamento", ACTIVE: "Ativo", COMPLETED: "Concluído", CANCELED: "Cancelado" };
const sessionStatusLabels = { PENDING: "Pendente", SCHEDULED: "Agendada", COMPLETED: "Concluída", CANCELED: "Cancelada" };

const emptyPlan = {
  templateId: "",
  description: "",
  frequency: "WEEKLY",
  sessions: 4,
  items: []
};

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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

function copyPlan(plan) {
  return {
    templateId: plan.templateId || "",
    description: plan.description || "",
    frequency: plan.frequency || "WEEKLY",
    sessions: plan.sessions || 4,
    items: (plan.items || []).map((item) => ({ ...item }))
  };
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function planStatusClass(status) {
  return status === "ACTIVE" ? "active" : status === "CANCELED" || status === "COMPLETED" ? "muted" : "warning";
}

export default function ProntuarioPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patientId = Number(id);
  const [patient, setPatient] = useState(null);
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(null);
  const [consultationText, setConsultationText] = useState("");
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("information");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);

  const history = useMemo(() => {
    if (!patient) return [];
    return [
      ...(patient.consultations || []).map((item) => ({ ...item, type: "consultation" })),
      ...(patient.analysisEvents || []).map((item) => ({ ...item, type: "analysis" }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [patient]);

  async function load() {
    if (!Number.isInteger(patientId)) {
      setError("Paciente inválido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [patientData, planData, templateData, doctorData] = await Promise.all([
        api.patient(patientId),
        api.patientPlans(patientId),
        api.planTemplates(),
        api.doctors()
      ]);
      setPatient(patientData.patient);
      setForm(patientToForm(patientData.patient));
      setPlans(planData.plans || []);
      setTemplates(templateData.templates || []);
      setDoctors(doctorData.doctors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [patientId]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function savePatient(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const data = await api.updatePatient(patient.id, form);
      setPatient(data.patient);
      setForm(patientToForm(data.patient));
      setMessage("Dados do paciente salvos.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function addConsultation(event) {
    event.preventDefault();
    if (!consultationText.trim()) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await api.createConsultation(patient.id, { notes: consultationText });
      setConsultationText("");
      await load();
      setMessage("Consulta adicionada ao prontuário.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function deletePatient() {
    if (!window.confirm("Deseja realmente remover este paciente?")) return;
    try {
      await api.deletePatient(patient.id);
      navigate("/pacientes", { replace: true });
    } catch (err) { setError(err.message); }
  }

  function openLab() {
    const query = new URLSearchParams({ patientId: String(patient.id), clinicId: String(patient.clinicId) });
    navigate(`/bioo3-lab?${query.toString()}`);
  }

  function openCreatePlan() {
    const template = templates[0];
    setEditingPlan(null);
    setPlanForm(template ? {
      ...emptyPlan,
      templateId: template.id,
      frequency: template.frequency,
      sessions: template.sessions,
      items: template.items.map((item) => ({ productName: item.productName, route: item.route, quantity: item.quantity }))
    } : emptyPlan);
    setPlanModalOpen(true); setError(""); setMessage("");
  }

  function openEditPlan(plan) {
    setEditingPlan(plan);
    setPlanForm(copyPlan(plan));
    setPlanModalOpen(true); setError(""); setMessage("");
  }

  function closePlanModal() {
    setPlanModalOpen(false); setEditingPlan(null);
  }

  function chooseTemplate(templateId) {
    const template = templates.find((item) => String(item.id) === String(templateId));
    if (!template) return;
    setPlanForm((current) => ({
      ...current,
      templateId: template.id,
      frequency: template.frequency,
      sessions: template.sessions,
      items: template.items.map((item) => ({ productName: item.productName, route: item.route, quantity: item.quantity }))
    }));
  }

  function updatePlanItem(index, field, value) {
    setPlanForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  async function submitPlan(event) {
    event.preventDefault();
    if (!planForm.templateId) { setError("Selecione um modelo de plano."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      if (editingPlan) await api.updatePatientPlan(editingPlan.id, planForm);
      else await api.createPatientPlan({ patientId: patient.id, ...planForm });
      closePlanModal();
      await load();
      setMessage(editingPlan ? "Plano atualizado." : "Plano criado como orçamento.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function changePlanStatus(plan, status) {
    setError(""); setMessage("");
    try {
      await api.updatePatientPlanStatus(plan.id, status);
      await load();
      setMessage(status === "ACTIVE" ? "Plano ativado." : status === "CANCELED" ? "Plano cancelado." : "Plano concluído.");
    } catch (err) { setError(err.message); }
  }

  async function changeSessionStatus(plan, session) {
    const next = session.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await api.updatePlanSession(plan.id, session.number, next);
      await load();
    } catch (err) { setError(err.message); }
  }

  function printPlan(plan, exportPdf = false) {
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) { setError("Não foi possível abrir a janela de impressão."); return; }
    const items = (plan.items || []).map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(routeLabels[item.route] || item.route)}</td><td>${escapeHtml(item.quantity)}</td></tr>`).join("");
    const sessions = (plan.planSessions || []).map((session) => `<tr><td>${session.number}</td><td>${escapeHtml(sessionStatusLabels[session.status] || session.status)}</td><td>${escapeHtml(formatDate(session.scheduledAt))}</td></tr>`).join("");
    printWindow.document.write(`<!doctype html><html><head><title>${exportPdf ? "Exportar" : "Imprimir"} plano - ${escapeHtml(patient.name)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#122533;font-size:12px}h1,h2{color:#075985}header{border-bottom:2px solid #bae6fd;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.box{border:1px solid #d8edf7;border-radius:8px;padding:9px;background:#f0f9ff}.box span{display:block;color:#647888;font-size:10px;text-transform:uppercase}.box strong{display:block;margin-top:3px}table{width:100%;border-collapse:collapse;margin:12px 0 22px}th,td{border:1px solid #d8edf7;padding:8px;text-align:left}th{background:#e0f2fe;color:#075985;text-transform:uppercase;font-size:10px}</style></head><body><header><div><h1>Plano do paciente</h1><div>BioO3</div></div><div>${escapeHtml(formatDate(new Date()))}</div></header><div class="grid"><div class="box"><span>Paciente</span><strong>${escapeHtml(patient.name)}</strong></div><div class="box"><span>Plano</span><strong>${escapeHtml(plan.name)}</strong></div><div class="box"><span>Frequência</span><strong>${escapeHtml(frequencyLabels[plan.frequency] || plan.frequency)}</strong></div><div class="box"><span>Sessões</span><strong>${escapeHtml(plan.sessions)}</strong></div></div><h2>Produtos</h2><table><thead><tr><th>Produto</th><th>Via</th><th>Quantidade</th></tr></thead><tbody>${items}</tbody></table><h2>Sessões</h2><table><thead><tr><th>Sessão</th><th>Status</th><th>Data</th></tr></thead><tbody>${sessions}</tbody></table>${plan.description ? `<h2>Observações</h2><p>${escapeHtml(plan.description)}</p>` : ""}</body></html>`);
    printWindow.document.close();
    printWindow.addEventListener("load", () => printWindow.print());
  }

  if (loading) return <div className="app-frame"><Topbar /><main className="page-shell"><TableSkeleton columns={4} rows={6} /></main></div>;

  return <div className="app-frame">
    <Topbar />
    <main className="page-shell prontuario-page">
      <section className="page-heading prontuario-heading"><div><p className="eyebrow">Prontuário</p><h1>{patient.name}</h1><p className="page-subtitle">Informações, histórico clínico e planos exclusivos deste paciente.</p></div></section>

      {(error || message) && <section className="panel prontuario-feedback"><p className={error ? "form-error" : "form-success"}>{error || message}</p></section>}

      <nav className="prontuario-sections" aria-label="Seções do prontuário">
        <button className={activeSection === "information" ? "active" : ""} type="button" onClick={() => setActiveSection("information")}>Informações do paciente</button>
        <button className={activeSection === "plans" ? "active" : ""} type="button" onClick={() => setActiveSection("plans")}>Planos</button>
        <button className={activeSection === "history" ? "active" : ""} type="button" onClick={() => setActiveSection("history")}>Histórico</button>
      </nav>

      {activeSection === "information" && <section className="panel prontuario-information-panel">
          <div className="panel-header"><div><h2>Informações do paciente</h2><p>Editadas diretamente no prontuário.</p></div><button className="primary-button" type="button" onClick={openLab}>Nova análise BioO3 Lab</button></div>
          <form className="form-grid" onSubmit={savePatient}>
            <label><span>Nome</span><input value={form.name} onChange={(e) => updateForm("name", e.target.value)} required /></label><label><span>Idade</span><input type="number" min="0" value={form.age} onChange={(e) => updateForm("age", e.target.value)} required /></label>
            <label><span>CPF</span><input value={form.cpf} onChange={(e) => updateForm("cpf", e.target.value)} /></label><label><span>Sexo</span><input value={form.gender} onChange={(e) => updateForm("gender", e.target.value)} /></label>
            <label><span>Telefone</span><input inputMode="numeric" maxLength="11" value={form.phone} onChange={(e) => updateForm("phone", e.target.value.replace(/\D/g, "").slice(0, 11))} /></label><label><span>Médico</span><select value={form.doctorId} onChange={(e) => updateForm("doctorId", e.target.value)}><option value="">Selecione o médico</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
            <label className="full-width"><span>Prescrição atual</span><textarea className="prescription-editor" rows="7" value={form.prescription} onChange={(e) => updateForm("prescription", e.target.value)} /></label>
            <button className="primary-button fit-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar informações"}</button>
          </form>
          <div className="patient-meta"><span>Cadastro</span><strong>{formatDate(patient.createdAt)}</strong><span>Clínica</span><strong>{patient.clinicName || "—"}</strong></div>
        </section>}

      {activeSection === "history" && <section className="panel history-panel prontuario-section-panel"><div className="panel-header"><div><h2>Histórico clínico</h2><p>Consultas, prescrições e análises por data.</p></div></div><form className="consultation-form" onSubmit={addConsultation}><label><span>Nova consulta</span><textarea rows="4" value={consultationText} onChange={(e) => setConsultationText(e.target.value)} placeholder="Observações da consulta" /></label><button className="secondary-button fit-button" type="submit" disabled={saving}>Adicionar consulta</button></form><div className="prontuario-timeline">{history.map((item) => { const preview = item.type === "analysis" ? `Análise registrada para este paciente (${item.source === "pdf" ? "PDF" : "entrada manual"}).` : item.notes; return <article className="timeline-entry" key={`${item.type}-${item.id}`}><div className="timeline-marker" /><div><div className="timeline-entry-heading"><strong>{item.type === "analysis" ? "Análise BioO3 Lab" : "Consulta"}</strong><time>{formatDateTime(item.createdAt)}</time></div><p className="history-entry-preview">{preview}</p><button className="secondary-button compact-button history-details-button" type="button" onClick={() => setSelectedHistoryEntry(item)}>Ver detalhes</button></div></article>; })}{!history.length && <p className="muted-text">Nenhum histórico registrado.</p>}</div></section>}

      {activeSection === "plans" && <section className="panel patient-plans-panel prontuario-section-panel"><div className="panel-header"><div><h2>Planos do paciente</h2><p>Todos os planos abaixo pertencem exclusivamente a {patient.name}.</p></div><button className="primary-button" type="button" onClick={openCreatePlan} disabled={!templates.length}>Criar plano</button></div>{!templates.length && <p className="muted-text">Crie um modelo global antes de criar um plano.</p>}{plans.map((plan) => <article className="patient-plan-card" key={plan.id}><div className="patient-plan-card-header"><div><p className="eyebrow plan-eyebrow">{planStatusLabels[plan.status]}</p><h3>{plan.name}</h3><p>{frequencyLabels[plan.frequency] || plan.frequency} · {plan.sessions} sessões · Criado em {formatDate(plan.createdAt)}</p></div><span className={`status-pill ${planStatusClass(plan.status)}`}>{planStatusLabels[plan.status]}</span></div>{plan.description && <p className="plan-description">{plan.description}</p>}<div className="plan-item-summary">{plan.items.map((item, index) => <span key={`${item.productName}-${index}`}>{item.productName} · {routeLabels[item.route] || item.route} · {item.quantity}</span>)}</div><div className="plan-session-list">{plan.planSessions.map((session) => <button className={`plan-session ${session.status === "COMPLETED" ? "completed" : ""}`} key={session.id} type="button" onClick={() => changeSessionStatus(plan, session)} disabled={plan.status === "CANCELED"}><strong>{session.number}</strong><span>{sessionStatusLabels[session.status] || session.status}</span></button>)}</div><div className="row-actions patient-plan-actions"><button className="secondary-button compact-button" type="button" onClick={() => printPlan(plan, false)}>Imprimir plano</button><button className="secondary-button compact-button" type="button" onClick={() => printPlan(plan, true)}>Exportar PDF</button>{plan.status === "QUOTE" && <><button className="secondary-button compact-button" type="button" onClick={() => openEditPlan(plan)}>Editar orçamento</button><button className="primary-button compact-button" type="button" onClick={() => changePlanStatus(plan, "ACTIVE")}>Ativar</button></>}{plan.status === "ACTIVE" && <button className="primary-button compact-button" type="button" onClick={() => changePlanStatus(plan, "COMPLETED")}>Concluir</button>}{plan.status !== "CANCELED" && plan.status !== "COMPLETED" && <button className="danger-button compact-button" type="button" onClick={() => changePlanStatus(plan, "CANCELED")}>Cancelar</button>}</div></article>)}{!plans.length && <div className="empty-state compact-empty">Nenhum plano criado para este paciente.</div>}</section>}
    </main>

    {planModalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="patient-plan-title"><div className="modal-card patient-plan-modal"><button className="modal-close" type="button" onClick={closePlanModal} aria-label="Fechar">×</button><h2 id="patient-plan-title">{editingPlan ? "Editar plano" : "Criar plano"}</h2><form className="form-grid" onSubmit={submitPlan}><label className="full-width"><span>Modelo global</span><select value={planForm.templateId} onChange={(e) => chooseTemplate(e.target.value)} disabled={Boolean(editingPlan)} required><option value="">Selecione um modelo</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label><span>Frequência</span><select value={planForm.frequency} onChange={(e) => setPlanForm({ ...planForm, frequency: e.target.value })}><option value="WEEKLY">Semanal</option><option value="BIWEEKLY">Quinzenal</option><option value="MONTHLY">Mensal</option></select></label><label><span>Sessões</span><input type="number" min="1" max="100" value={planForm.sessions} onChange={(e) => setPlanForm({ ...planForm, sessions: e.target.value })} required /></label><label className="full-width"><span>Informações complementares</span><textarea rows="4" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></label><div className="full-width plan-modal-items"><span className="field-heading">Produtos</span>{planForm.items.map((item, index) => <div className="plan-modal-item" key={index}><strong>{item.productName}</strong><span>{routeLabels[item.route] || item.route}</span><input type="number" min="1" value={item.quantity} onChange={(e) => updatePlanItem(index, "quantity", e.target.value)} aria-label={`Quantidade de ${item.productName}`} /></div>)}</div><div className="modal-actions full-width"><button className="secondary-button" type="button" onClick={closePlanModal}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar plano"}</button></div></form></div></div>}
    {selectedHistoryEntry && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><div className="modal-card history-detail-modal"><button className="modal-close" type="button" onClick={() => setSelectedHistoryEntry(null)} aria-label="Fechar">×</button><p className="eyebrow modal-eyebrow">{selectedHistoryEntry.type === "analysis" ? "Análise BioO3 Lab" : "Consulta"}</p><h2 id="history-detail-title">Detalhes do registro</h2><p className="history-detail-date">{formatDateTime(selectedHistoryEntry.createdAt)}</p>{selectedHistoryEntry.type === "analysis" ? <div className="history-detail-content"><p>Análise registrada para este paciente.</p><strong>Origem: {selectedHistoryEntry.source === "pdf" ? "PDF" : "Entrada manual"}</strong></div> : <pre className="history-detail-content">{selectedHistoryEntry.notes}</pre>}</div></div>}
  </div>;
}
