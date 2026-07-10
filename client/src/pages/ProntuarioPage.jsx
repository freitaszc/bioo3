import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { TableSkeleton } from "../components/Skeleton";
import ActionButton from "../components/ActionButton";

const frequencyLabels = { WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal" };
const routeLabels = { INTRAMUSCULAR: "Intramuscular", INTRAVENOUS: "Endovenosa", SUBCUTANEOUS: "Subcutânea" };
const unitLabels = { DOSE: "Dose", AMPOULE: "Ampola", ML: "mL", UI: "UI", VIAL: "Frasco", TABLET: "Comprimido", UNIT: "Unidade", OTHER: "Outra" };
const planStatusLabels = { QUOTE: "Orçamento", ACTIVE: "Ativo", INACTIVE: "Inativo", COMPLETED: "Concluído", CANCELED: "Cancelado" };
const sessionStatusLabels = { PENDING: "Pendente", SCHEDULED: "Agendada", COMPLETED: "Concluída", CANCELED: "Cancelada" };

const emptyPlan = {
  name: "",
  description: "",
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

function todayDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
    name: plan.name || "",
    description: plan.description || "",
    items: (plan.items || []).map((item) => ({ preparation: "", application: "", unit: "DOSE", sessions: plan.sessions || 4, intervalDays: 7, unitPrice: 0, ...item }))
  };
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function planStatusClass(status) {
  return status === "ACTIVE" ? "active" : status === "CANCELED" || status === "COMPLETED" || status === "INACTIVE" ? "muted" : "warning";
}

function PlanActionsMenu({ plan, disabled, onAction }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnViewportChange() { setOpen(false); }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  function toggleMenu(event) {
    if (open) { setOpen(false); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 190;
    const estimatedHeight = 280;
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)),
      top: rect.bottom + estimatedHeight > window.innerHeight ? Math.max(12, rect.top - estimatedHeight) : rect.bottom + 6
    });
    setOpen(true);
  }

  function choose(action) {
    setOpen(false);
    onAction(plan, action);
  }

  return <div className="plan-actions-menu" ref={menuRef}>
    <button className="plan-actions-trigger" type="button" onClick={toggleMenu} disabled={disabled} aria-label={`Ações do plano ${plan.name}`} aria-haspopup="menu" aria-expanded={open}>•••</button>
    {open && <div className="plan-actions-dropdown" style={position} role="menu">
      <button type="button" role="menuitem" onClick={() => choose("print")}>Imprimir</button>
      <button type="button" role="menuitem" onClick={() => choose("export")}>Exportar PDF</button>
      {plan.status === "QUOTE" && <button type="button" role="menuitem" onClick={() => choose("edit")}>Editar</button>}
      {(plan.status === "QUOTE" || plan.status === "INACTIVE") && <button type="button" role="menuitem" onClick={() => choose("activate")}>Ativar</button>}
      {plan.status === "ACTIVE" && <button type="button" role="menuitem" onClick={() => choose("inactivate")}>Inativar</button>}
      {plan.status === "ACTIVE" && <button type="button" role="menuitem" onClick={() => choose("complete")}>Concluir</button>}
      {plan.status !== "CANCELED" && plan.status !== "COMPLETED" && <button className="cancel-action" type="button" role="menuitem" onClick={() => choose("cancel")}>Cancelar</button>}
    </div>}
  </div>;
}

export default function ProntuarioPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patientId = Number(id);
  const [patient, setPatient] = useState(null);
  const [plans, setPlans] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const templates = catalog;
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(null);
  const [consultationText, setConsultationText] = useState("");
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [planError, setPlanError] = useState("");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("information");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);
  const [selectedSessionPlan, setSelectedSessionPlan] = useState(null);
  const [updatingPlanIds, setUpdatingPlanIds] = useState([]);
  const [updatingSessionIds, setUpdatingSessionIds] = useState([]);
  const [sessionError, setSessionError] = useState("");
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ title: "Consulta", day: todayDateKey(), time: "09:00", notes: "" });

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
      const [patientData, planData, catalogData, doctorData] = await Promise.all([
        api.patient(patientId),
        api.patientPlans(patientId),
        api.planCatalog().catch(() => ({ products: [] })),
        api.doctors().catch(() => ({ doctors: [] }))
      ]);
      setPatient(patientData.patient);
      setForm(patientToForm(patientData.patient));
      setPlans(planData.plans || []);
      setCatalog(catalogData.products || []);
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

  function openAppointment() {
    setAppointmentForm({ title: "Consulta", day: todayDateKey(), time: "09:00", notes: "" });
    setAppointmentModalOpen(true);
    setError("");
    setMessage("");
  }

  async function submitAppointment(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.createAgendaEvent({ ...appointmentForm, patientId: patient.id });
      setAppointmentModalOpen(false);
      await load();
      setMessage("Agendamento criado e adicionado ao histórico.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm({ ...emptyPlan, items: [] });
    setPlanModalOpen(true); setPlanError(""); setError(""); setMessage("");
  }

  function openEditPlan(plan) {
    setEditingPlan(plan);
    setPlanForm(copyPlan(plan));
    setPlanModalOpen(true); setPlanError(""); setError(""); setMessage("");
  }

  function closePlanModal() {
    setPlanModalOpen(false); setEditingPlan(null); setPlanError("");
  }

  function addPlanItem() {
    const product = catalog[0];
    setPlanForm((current) => ({
      ...current,
      items: [...current.items, product ? { productName: product.name, route: product.route, preparation: product.preparation, application: product.application, quantity: 1, unit: "DOSE", sessions: 4, intervalDays: 7, unitPrice: 0 } : { productName: "", route: "INTRAMUSCULAR", preparation: "", application: "", quantity: 1, unit: "DOSE", sessions: 4, intervalDays: 7, unitPrice: 0 }]
    }));
  }

  function chooseProduct(index, productName) {
    const product = catalog.find((item) => item.name === productName);
    if (!product) return;
    setPlanForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, productName: product.name, route: product.route, preparation: product.preparation, application: product.application } : item) }));
  }

  function removePlanItem(index) {
    setPlanForm((current) => ({ ...current, items: current.items.filter((_item, itemIndex) => itemIndex !== index) }));
  }

  function updatePlanItem(index, field, value) {
    setPlanForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  async function submitPlan(event) {
    event.preventDefault();
    if (!planForm.name.trim()) { setPlanError("Informe um nome para o plano."); return; }
    if (saving) return;
    setSaving(true); setPlanError(""); setError(""); setMessage("");
    try {
      const printAfterSave = event.nativeEvent.submitter?.value === "export";
      const data = editingPlan ? await api.updatePatientPlan(editingPlan.id, planForm) : await api.createPatientPlan({ patientId: patient.id, ...planForm });
      if (data?.plan) {
        setPlans((current) => editingPlan
          ? current.map((plan) => plan.id === data.plan.id ? data.plan : plan)
          : [data.plan, ...current]);
      }
      closePlanModal();
      setMessage(editingPlan ? "Plano atualizado." : "Plano criado como orçamento.");
      if (printAfterSave && data?.plan) setTimeout(() => printPlan(data.plan, true), 0);
    } catch (err) { setPlanError(err.message); }
    finally { setSaving(false); }
  }

  async function changePlanStatus(plan, status) {
    if (updatingPlanIds.includes(plan.id)) return;
    setError(""); setMessage("");
    setUpdatingPlanIds((current) => [...current, plan.id]);
    setPlans((current) => current.map((item) => item.id === plan.id ? { ...item, status } : item));
    try {
      const data = await api.updatePatientPlanStatus(plan.id, status);
      if (data?.plan) setPlans((current) => current.map((item) => item.id === plan.id ? data.plan : item));
      setMessage(status === "ACTIVE" ? "Plano ativado." : status === "INACTIVE" ? "Plano inativado." : status === "CANCELED" ? "Plano cancelado." : "Plano concluído.");
    } catch (err) {
      setPlans((current) => current.map((item) => item.id === plan.id ? plan : item));
      setError(err.message);
    } finally {
      setUpdatingPlanIds((current) => current.filter((id) => id !== plan.id));
    }
  }

  function handlePlanAction(plan, action) {
    if (!action) return;
    if (action === "print") printPlan(plan, false);
    if (action === "export") printPlan(plan, true);
    if (action === "edit") openEditPlan(plan);
    if (action === "activate") changePlanStatus(plan, "ACTIVE");
    if (action === "inactivate") changePlanStatus(plan, "INACTIVE");
    if (action === "complete") changePlanStatus(plan, "COMPLETED");
    if (action === "cancel") changePlanStatus(plan, "CANCELED");
  }

  function openSessionPlan(plan) {
    setSelectedSessionPlan(plan);
    setSessionError("");
  }

  async function changeSessionStatus(plan, session) {
    if (updatingSessionIds.includes(session.id)) return;
    const next = session.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    const optimisticSession = {
      ...session,
      status: next,
      completedAt: next === "COMPLETED" ? new Date().toISOString() : null
    };
    const replaceSession = (currentPlan, replacement) => ({
      ...currentPlan,
      planSessions: currentPlan.planSessions.map((item) => item.number === session.number ? replacement : item)
    });
    setSessionError("");
    setUpdatingSessionIds((current) => [...current, session.id]);
    setPlans((current) => current.map((item) => item.id === plan.id ? replaceSession(item, optimisticSession) : item));
    setSelectedSessionPlan((current) => current?.id === plan.id ? replaceSession(current, optimisticSession) : current);
    try {
      const data = await api.updatePlanSession(plan.id, session.number, next);
      setPlans((current) => current.map((item) => item.id === plan.id ? replaceSession(item, data.session) : item));
      setSelectedSessionPlan((current) => current?.id === plan.id ? replaceSession(current, data.session) : current);
    } catch (err) {
      setPlans((current) => current.map((item) => item.id === plan.id ? replaceSession(item, session) : item));
      setSelectedSessionPlan((current) => current?.id === plan.id ? replaceSession(current, session) : current);
      setSessionError(err.message);
    } finally {
      setUpdatingSessionIds((current) => current.filter((id) => id !== session.id));
    }
  }

  function printPlan(plan, exportPdf = false) {
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) { setError("Não foi possível abrir a janela de impressão."); return; }
    const items = (plan.items || []).map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(routeLabels[item.route] || item.route)}</td><td>${escapeHtml(item.quantity)} ${escapeHtml(unitLabels[item.unit] || item.unit || "Dose")}</td><td>${escapeHtml(item.sessions || plan.sessions)}</td><td>${escapeHtml(item.intervalDays || 7)} dias</td><td>R$ ${(Number(item.unitPrice || 0) * Number(item.quantity || 0) * Number(item.sessions || plan.sessions || 0)).toFixed(2)}</td></tr>`).join("");
    const sessions = (plan.planSessions || []).map((session) => `<tr><td>${session.number}</td><td>${escapeHtml(sessionStatusLabels[session.status] || session.status)}</td><td>${escapeHtml(formatDate(session.scheduledAt))}</td></tr>`).join("");
    printWindow.document.write(`<!doctype html><html><head><title>${exportPdf ? "Exportar" : "Imprimir"} plano - ${escapeHtml(patient.name)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#122533;font-size:12px}h1,h2{color:#075985}header{border-bottom:2px solid #bae6fd;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.box{border:1px solid #d8edf7;border-radius:8px;padding:9px;background:#f0f9ff}.box span{display:block;color:#647888;font-size:10px;text-transform:uppercase}.box strong{display:block;margin-top:3px}table{width:100%;border-collapse:collapse;margin:12px 0 22px}th,td{border:1px solid #d8edf7;padding:8px;text-align:left}th{background:#e0f2fe;color:#075985;text-transform:uppercase;font-size:10px}</style></head><body><header><div><h1>Plano do paciente</h1><div>BioO3</div></div><div>${escapeHtml(formatDate(new Date()))}</div></header><div class="grid"><div class="box"><span>Paciente</span><strong>${escapeHtml(patient.name)}</strong></div><div class="box"><span>Plano</span><strong>${escapeHtml(plan.name)}</strong></div><div class="box"><span>Frequência padrão</span><strong>${escapeHtml(frequencyLabels[plan.frequency] || plan.frequency)}</strong></div><div class="box"><span>Valor estimado</span><strong>R$ ${Number(plan.estimatedTotal || 0).toFixed(2)}</strong></div></div><h2>Produtos prescritos</h2><table><thead><tr><th>Produto</th><th>Via</th><th>Quantidade</th><th>Sessões</th><th>Intervalo</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><h2>Sessões</h2><table><thead><tr><th>Sessão</th><th>Status</th><th>Data</th></tr></thead><tbody>${sessions}</tbody></table>${plan.description ? `<h2>Observações</h2><p>${escapeHtml(plan.description)}</p>` : ""}</body></html>`);
    printWindow.document.close();
    printWindow.addEventListener("load", () => printWindow.print());
  }

  if (loading) return <div className="app-frame"><main className="page-shell"><TableSkeleton columns={4} rows={6} /></main></div>;

  return <div className="app-frame">
    <main className="page-shell prontuario-page">
      <section className="page-heading prontuario-heading"><div><p className="eyebrow">Prontuário</p><h1>{patient.name}</h1><p className="page-subtitle">Informações, histórico clínico e planos exclusivos deste paciente.</p></div><button className="secondary-button" type="button" onClick={openAppointment}>Novo agendamento</button></section>

      {(error || message) && <section className="panel prontuario-feedback"><p className={error ? "form-error" : "form-success"}>{error || message}</p></section>}

      <nav className="prontuario-sections" aria-label="Seções do prontuário">
        <button className={`section-toggle ${activeSection === "information" ? "active" : "inactive"}`} type="button" aria-pressed={activeSection === "information"} onClick={() => setActiveSection("information")}>Informações do paciente</button>
        <button className={`section-toggle ${activeSection === "plans" ? "active" : "inactive"}`} type="button" aria-pressed={activeSection === "plans"} onClick={() => setActiveSection("plans")}>Planos</button>
        <button className={`section-toggle ${activeSection === "history" ? "active" : "inactive"}`} type="button" aria-pressed={activeSection === "history"} onClick={() => setActiveSection("history")}>Histórico</button>
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

      {activeSection === "plans" && <section className="panel patient-plans-panel prontuario-section-panel">
        <div className="panel-header">
          <div><h2>Planos do paciente</h2></div>
          <button className="primary-button" type="button" onClick={openCreatePlan} disabled={!templates.length}>Criar plano</button>
        </div>
        {plans.length > 0 && <div className="table-wrap">
          <table className="control-table patient-plans-table">
            <colgroup><col className="plan-column" /><col className="products-column" /><col className="sessions-column" /><col className="value-column" /><col className="status-column" /><col className="actions-column" /></colgroup>
            <thead><tr><th>Plano</th><th className="center">Produtos prescritos</th><th className="center">Sessões</th><th className="center">Valor</th><th className="center">Status</th><th className="center">Ações</th></tr></thead>
            <tbody>{plans.map((plan) => {
              const completedSessions = plan.planSessions.filter((session) => session.status === "COMPLETED").length;
              return <tr key={plan.id}>
                <td>
                  <strong className="strong-cell">{plan.name}</strong>
                  <small>{formatDate(plan.createdAt)}</small>
                  {plan.description && <small className="plan-table-description">{plan.description}</small>}
                </td>
                <td className="center"><div className="plan-table-products">
                  {plan.items.slice(0, 2).map((item, index) => <span key={`${item.productName}-${index}`}>{item.productName} · {item.quantity} {unitLabels[item.unit] || item.unit || "Dose"}</span>)}
                  {plan.items.length > 2 && <span className="more-products">+{plan.items.length - 2} {plan.items.length - 2 === 1 ? "produto" : "produtos"}</span>}
                </div></td>
                <td className="center"><button className="plan-session-summary" type="button" onClick={() => openSessionPlan(plan)}>
                  <strong>{completedSessions}/{plan.planSessions.length}</strong><span>concluídas</span>
                </button></td>
                <td className="plan-value-cell center">R$ {Number(plan.estimatedTotal || 0).toFixed(2)}</td>
                <td className="center"><button className={`status-pill patient-status-button ${planStatusClass(plan.status)}`} type="button" disabled={updatingPlanIds.includes(plan.id) || plan.status === "CANCELED" || plan.status === "COMPLETED"} onClick={() => changePlanStatus(plan, plan.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")} title={plan.status === "ACTIVE" ? "Clique para inativar" : "Clique para ativar"}>{planStatusLabels[plan.status]}</button></td>
                <td className="center"><PlanActionsMenu plan={plan} disabled={updatingPlanIds.includes(plan.id)} onAction={handlePlanAction} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {!plans.length && <div className="empty-state compact-empty">Nenhum plano criado para este paciente.</div>}
      </section>}
    </main>

    {planModalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="patient-plan-title"><div className="modal-card patient-plan-modal"><button className="modal-close" type="button" onClick={closePlanModal} aria-label="Fechar">×</button><h2 id="patient-plan-title">{editingPlan ? "Editar plano" : "Criar plano"}</h2><form className="form-grid" onSubmit={submitPlan}><label className="full-width"><span>Nome do plano</span><input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Ex.: Protocolo ADEK" required /></label><div className="full-width plan-modal-items"><div className="template-items-heading"><span>Produtos prescritos</span><button className="secondary-button compact-button" type="button" onClick={addPlanItem} disabled={!catalog.length}>Adicionar produto</button></div>{!planForm.items.length && <p className="muted-text">Adicione pelo menos um produto ao plano.</p>}{planForm.items.map((item, index) => <div className="plan-modal-item plan-modal-item-detailed" key={index}><label className="full-width"><span>Produto</span><select value={item.productName} onChange={(e) => chooseProduct(index, e.target.value)} required><option value="">Selecione o produto</option>{catalog.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label><span>{routeLabels[item.route] || item.route}</span><label><span>Quantidade</span><input type="number" min="1" value={item.quantity} onChange={(e) => updatePlanItem(index, "quantity", e.target.value)} required /></label><label><span>Unidade</span><select value={item.unit || "DOSE"} onChange={(e) => updatePlanItem(index, "unit", e.target.value)}>{Object.entries(unitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Sessões</span><input type="number" min="1" max="100" value={item.sessions || 4} onChange={(e) => updatePlanItem(index, "sessions", e.target.value)} required /></label><label><span>A cada (dias)</span><input type="number" min="1" max="365" value={item.intervalDays || 7} onChange={(e) => updatePlanItem(index, "intervalDays", e.target.value)} required /></label><label><span>Preço unitário (R$)</span><input type="number" min="0" step="0.01" value={item.unitPrice || 0} onChange={(e) => updatePlanItem(index, "unitPrice", e.target.value)} required /></label><small className="plan-item-instructions"><strong>Preparo:</strong> {item.preparation || "Não informado"}<br /><strong>Aplicação:</strong> {item.application || "Não informado"}</small><ActionButton action="delete" iconOnly onClick={() => removePlanItem(index)} aria-label={`Remover ${item.productName || "produto"}`} /></div>)}</div><label className="full-width"><span>Informações complementares</span><textarea rows="3" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></label>{planError && <p className="form-error full-width plan-modal-error" role="alert">{planError}</p>}<div className="modal-actions full-width"><button className="secondary-button" type="button" onClick={closePlanModal}>Cancelar</button><button className="secondary-button" name="save" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar plano"}</button><button className="primary-button" name="export" value="export" type="submit" disabled={saving}>Salvar e exportar</button></div></form></div></div>}
    {selectedSessionPlan && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="plan-sessions-title"><div className="modal-card plan-sessions-modal"><button className="modal-close" type="button" onClick={() => setSelectedSessionPlan(null)} aria-label="Fechar">×</button><p className="eyebrow modal-eyebrow">Acompanhamento</p><h2 id="plan-sessions-title">Sessões — {selectedSessionPlan.name}</h2><p className="muted-text">Clique em uma sessão para alternar entre pendente e concluída.</p>{sessionError && <p className="form-error session-modal-error" role="alert">{sessionError}</p>}<div className="plan-session-list">{selectedSessionPlan.planSessions.map((session) => { const completed = session.status === "COMPLETED"; const updating = updatingSessionIds.includes(session.id); return <button className={`plan-session ${completed ? "completed" : "pending"} ${updating ? "updating" : ""}`} key={session.id} type="button" aria-pressed={completed} onClick={() => changeSessionStatus(selectedSessionPlan, session)} disabled={updating}><strong>Sessão {session.number}</strong><span>{sessionStatusLabels[session.status] || session.status}</span><small>{completed ? "Clique para marcar como pendente" : "Clique para concluir"}</small></button>; })}</div></div></div>}
    {selectedHistoryEntry && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><div className="modal-card history-detail-modal"><button className="modal-close" type="button" onClick={() => setSelectedHistoryEntry(null)} aria-label="Fechar">×</button><p className="eyebrow modal-eyebrow">{selectedHistoryEntry.type === "analysis" ? "Análise BioO3 Lab" : "Consulta"}</p><h2 id="history-detail-title">Detalhes do registro</h2><p className="history-detail-date">{formatDateTime(selectedHistoryEntry.createdAt)}</p>{selectedHistoryEntry.type === "analysis" ? <div className="history-detail-content"><p>Análise registrada para este paciente.</p><strong>Origem: {selectedHistoryEntry.source === "pdf" ? "PDF" : "Entrada manual"}</strong></div> : <pre className="history-detail-content">{selectedHistoryEntry.notes}</pre>}</div></div>}
    {appointmentModalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appointment-title"><div className="modal-card"><button className="modal-close" type="button" onClick={() => setAppointmentModalOpen(false)} aria-label="Fechar">×</button><h2 id="appointment-title">Novo agendamento</h2><form className="form-grid" onSubmit={submitAppointment}><label className="full-width"><span>Título</span><input value={appointmentForm.title} onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })} required /></label><label><span>Dia</span><input type="date" value={appointmentForm.day} onChange={(e) => setAppointmentForm({ ...appointmentForm, day: e.target.value })} required /></label><label><span>Horário</span><input type="time" value={appointmentForm.time} onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })} required /></label><label className="full-width"><span>Notas</span><textarea rows="4" value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} /></label><div className="modal-actions full-width"><button className="secondary-button" type="button" onClick={() => setAppointmentModalOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar agendamento"}</button></div></form></div></div>}
  </div>;
}
