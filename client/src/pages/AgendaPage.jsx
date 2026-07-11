import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { AgendaSkeleton, SummarySkeleton } from "../components/Skeleton";
import ActionButton from "../components/ActionButton";

const emptyEvent = {
  title: "",
  day: "",
  time: "",
  notes: "",
  patientId: ""
};

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function buildCalendarDays(currentMonth) {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function AgendaPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [patients, setPatients] = useState([]);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [editingEvent, setEditingEvent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const eventsByDay = useMemo(() => {
    return events.reduce((acc, event) => {
      acc[event.date] ||= [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [events]);
  const scheduledPatients = useMemo(() => new Set(events.filter((event) => event.patientId).map((event) => event.patientId)).size, [events]);

  function loadEvents(month = currentMonth) {
    setLoading(true);
    setError("");
    return api.agendaEvents(monthKey(month))
      .then((data) => {
        setEvents(data.events || []);
        setTotalEvents(data.summary?.totalEvents || 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEvents(currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    api.patients({ status: "Ativo" }).then((data) => setPatients(data.patients || [])).catch(() => setPatients([]));
  }, []);

  function openCreate(day = dayKey(new Date())) {
    setEditingEvent(null);
    setEventForm({ ...emptyEvent, day, time: "09:00" });
    setModalOpen(true);
  }

  function openEdit(event) {
    setEditingEvent(event);
    setEventForm({
      title: event.title || "",
      day: event.date || "",
      time: event.time || "",
      notes: event.notes || "",
      patientId: event.patientId || ""
    });
    setModalOpen(true);
  }

  function changeMonth(delta) {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function submitEvent(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const action = editingEvent
      ? api.updateAgendaEvent(editingEvent.id, eventForm)
      : api.createAgendaEvent(eventForm);

    action
      .then(() => {
        setModalOpen(false);
        setEditingEvent(null);
        setEventForm(emptyEvent);
        return loadEvents();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  }

  function deleteEvent() {
    if (!editingEvent || !window.confirm("Remover este evento da agenda?")) return;
    api.deleteAgendaEvent(editingEvent.id)
      .then(() => {
        setModalOpen(false);
        setEditingEvent(null);
        return loadEvents();
      })
      .catch((err) => setError(err.message));
  }

  return (
    <div className="app-frame">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Agenda</p>
            <h1>Agenda de compromissos</h1>
            <p className="page-subtitle">Clique em um dia para agendar título, horário e observações.</p>
          </div>
          <button className="primary-button" type="button" onClick={() => openCreate()}>Novo evento</button>
        </section>

        <section className="panel agenda-panel">
          {loading ? <SummarySkeleton className="table-summary" /> : <div className="summary-grid table-summary">
            <div><strong>{events.length}</strong><span>Compromissos no mês</span></div>
            <div><strong>{scheduledPatients}</strong><span>Pacientes agendados</span></div>
            <div><strong>{totalEvents}</strong><span>Total de compromissos</span></div>
          </div>}
          <div className="agenda-toolbar">
            <button className="secondary-button compact-button" type="button" onClick={() => changeMonth(-1)}>Anterior</button>
            <h2>{formatMonth(currentMonth)}</h2>
            <button className="secondary-button compact-button" type="button" onClick={() => changeMonth(1)}>Próximo</button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading && <AgendaSkeleton />}
          {!loading && (
            <div className="agenda-grid">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => (
                <div className="agenda-weekday" key={label}>{label}</div>
              ))}
              {days.map((date) => {
                const key = dayKey(date);
                const isOutside = date.getMonth() !== currentMonth.getMonth();
                const dayEvents = eventsByDay[key] || [];
                return (
                  <button
                    className={`agenda-day ${isOutside ? "outside" : ""}`}
                    type="button"
                    key={key}
                    onClick={() => openCreate(key)}
                  >
                    <span className="agenda-day-number">{date.getDate()}</span>
                    <span className="agenda-events">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          className="agenda-event-chip"
                          key={event.id}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            openEdit(event);
                          }}
                        >
                          {event.time} {event.title}{event.patientName ? ` · ${event.patientName}` : ""}
                        </span>
                      ))}
                      {dayEvents.length > 3 && <span className="agenda-more">+{dayEvents.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={() => setModalOpen(false)}>×</button>
            <h2>{editingEvent ? "Editar compromisso" : "Novo compromisso"}</h2>
            <form className="form-grid" onSubmit={submitEvent}>
              <label className="full-width"><span>Título</span><input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} required /></label>
              <label><span>Dia</span><input type="date" value={eventForm.day} onChange={(event) => setEventForm({ ...eventForm, day: event.target.value })} required /></label>
              <label><span>Horário</span><input type="time" value={eventForm.time} onChange={(event) => setEventForm({ ...eventForm, time: event.target.value })} required /></label>
              <label className="full-width"><span>Paciente (opcional)</span><select value={eventForm.patientId} onChange={(event) => setEventForm({ ...eventForm, patientId: event.target.value })}><option value="">Sem paciente vinculado</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
              <label className="full-width"><span>Notas</span><textarea value={eventForm.notes} onChange={(event) => setEventForm({ ...eventForm, notes: event.target.value })} rows="4" /></label>
              <div className="modal-actions full-width">
                {editingEvent && <ActionButton action="delete" onClick={deleteEvent}>Remover evento</ActionButton>}
                <button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar compromisso"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
