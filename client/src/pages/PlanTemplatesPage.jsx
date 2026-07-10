import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import Topbar from "../components/Topbar";
import { TableSkeleton } from "../components/Skeleton";

const frequencies = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal"
};

const routes = {
  INTRAMUSCULAR: "Intramuscular",
  INTRAVENOUS: "Endovenosa",
  SUBCUTANEOUS: "Subcutânea"
};

const emptyItem = () => ({ productName: "", route: "INTRAMUSCULAR", quantity: 1 });
const emptyTemplate = () => ({
  name: "",
  description: "",
  frequency: "WEEKLY",
  sessions: 4,
  items: [emptyItem()]
});

function copyTemplate(template) {
  return {
    name: template.name || "",
    description: template.description || "",
    frequency: template.frequency || "WEEKLY",
    sessions: template.sessions || 4,
    items: (template.items || []).map((item) => ({
      productName: item.productName || "",
      route: item.route || "INTRAMUSCULAR",
      quantity: item.quantity || 1
    }))
  };
}

export default function PlanTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState(emptyTemplate);

  function loadTemplates() {
    setLoading(true);
    setError("");
    return api.planTemplates()
      .then((data) => setTemplates(data.templates || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  if (user?.role !== "ADMIN") return <Navigate to="/inicio" replace />;

  function openCreate() {
    setEditingTemplate(null);
    setForm(emptyTemplate());
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEdit(template) {
    setEditingTemplate(template);
    setForm(copyTemplate(template));
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTemplate(null);
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (!form.items.length) {
        setError("Adicione pelo menos um produto ao modelo.");
        return;
      }
      const action = editingTemplate
        ? api.updatePlanTemplate(editingTemplate.id, form)
        : api.createPlanTemplate(form);
      await action;
      closeModal();
      setMessage(editingTemplate ? "Modelo atualizado." : "Modelo criado.");
      await loadTemplates();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeTemplate(template) {
    if (!window.confirm(`Excluir o modelo “${template.name}”?`)) return;
    setError("");
    setMessage("");
    try {
      await api.deletePlanTemplate(template.id);
      setMessage("Modelo excluído.");
      await loadTemplates();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Administração</p>
            <h1>Modelos de planos</h1>
            <p className="page-subtitle">Crie modelos globais para aplicar aos planos dos pacientes.</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreate}>Novo modelo</button>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Modelos globais</h2>
              <p>Somente o administrador pode criar e manter esses modelos.</p>
            </div>
          </div>
          {error && !modalOpen && <p className="form-error">{error}</p>}
          {message && !modalOpen && <p className="form-success">{message}</p>}
          {loading && <TableSkeleton columns={5} rows={5} />}
          {!loading && (
            <div className="table-wrap">
              <table className="control-table templates-table">
                <thead>
                  <tr><th>Modelo</th><th>Frequência</th><th>Sessões</th><th>Produtos</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td><strong className="strong-cell">{template.name}</strong>{template.description && <small>{template.description}</small>}</td>
                      <td>{frequencies[template.frequency] || template.frequency}</td>
                      <td className="center">{template.sessions}</td>
                      <td>{template.items.length}</td>
                      <td><div className="row-actions">
                        <button className="secondary-button compact-button" type="button" onClick={() => openEdit(template)}>Editar</button>
                        <button className="danger-button compact-button" type="button" onClick={() => removeTemplate(template)}>Excluir</button>
                      </div></td>
                    </tr>
                  ))}
                  {!templates.length && <tr><td colSpan="5"><div className="empty-state compact-empty">Nenhum modelo cadastrado.</div></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
          <div className="modal-card template-modal-card">
            <button className="modal-close" type="button" onClick={closeModal} aria-label="Fechar">×</button>
            <h2 id="template-modal-title">{editingTemplate ? "Editar modelo" : "Novo modelo"}</h2>
            <form className="form-grid" onSubmit={submit}>
              <label><span>Nome do modelo</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label><span>Frequência</span><select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>{Object.entries(frequencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Sessões</span><input type="number" min="1" max="100" value={form.sessions} onChange={(event) => setForm({ ...form, sessions: event.target.value })} required /></label>
              <label className="full-width"><span>Descrição (opcional)</span><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>

              <div className="template-items-field full-width">
                <div className="template-items-heading"><div><span>Produtos do modelo</span><small>Defina a via e a quantidade de cada produto.</small></div><button className="secondary-button compact-button" type="button" onClick={addItem}>Adicionar produto</button></div>
                <div className="template-item-list">
                  {form.items.map((item, index) => (
                    <div className="template-item-row" key={index}>
                      <label><span>Produto</span><input value={item.productName} onChange={(event) => updateItem(index, "productName", event.target.value)} required /></label>
                      <label><span>Via</span><select value={item.route} onChange={(event) => updateItem(index, "route", event.target.value)}>{Object.entries(routes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label><span>Quantidade</span><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} required /></label>
                      <button className="danger-button compact-button template-item-remove" type="button" onClick={() => removeItem(index)} aria-label={`Remover produto ${index + 1}`}>Remover</button>
                    </div>
                  ))}
                </div>
              </div>
              {error && <p className="form-error full-width">{error}</p>}
              <button className="primary-button full-width" type="submit">Salvar modelo</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
