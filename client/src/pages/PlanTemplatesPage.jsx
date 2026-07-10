import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { TableSkeleton } from "../components/Skeleton";
import ActionButton from "../components/ActionButton";

const frequencies = { WEEKLY: "Semanal", BIWEEKLY: "Quinzenal", MONTHLY: "Mensal" };
const routes = { INTRAMUSCULAR: "Intramuscular", INTRAVENOUS: "Endovenosa", SUBCUTANEOUS: "Subcutânea" };
const units = { DOSE: "Dose", AMPOULE: "Ampola", ML: "mL", UI: "UI", VIAL: "Frasco", TABLET: "Comprimido", UNIT: "Unidade", OTHER: "Outra" };

const emptyItem = () => ({ productName: "", route: "INTRAMUSCULAR", preparation: "", application: "", quantity: 1, unit: "DOSE", sessions: 4, intervalDays: 7, unitPrice: 0 });
const emptyTemplate = () => ({ name: "", description: "", frequency: "WEEKLY", sessions: 4, items: [emptyItem()] });

function copyItem(item) {
  return {
    productName: item.productName || "",
    route: item.route || "INTRAMUSCULAR",
    preparation: item.preparation || "",
    application: item.application || "",
    quantity: item.quantity || 1,
    unit: item.unit || "DOSE",
    sessions: item.sessions || 4,
    intervalDays: item.intervalDays || 7,
    unitPrice: item.unitPrice || 0
  };
}

function copyTemplate(template) {
  return { name: template.name || "", description: template.description || "", frequency: template.frequency || "WEEKLY", sessions: template.sessions || 4, items: (template.items || []).map(copyItem) };
}

export default function PlanTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState(emptyTemplate);

  function loadData() {
    setLoading(true); setError("");
    return Promise.all([api.planTemplates(), api.planCatalog()])
      .then(([templateData, catalogData]) => { setTemplates(templateData.templates || []); setCatalog(catalogData.products || []); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);
  if (user?.role !== "ADMIN") return <Navigate to="/inicio" replace />;

  function openCreate() { setEditingTemplate(null); setForm(emptyTemplate()); setError(""); setMessage(""); setModalOpen(true); }
  function openEdit(template) { setEditingTemplate(template); setForm(copyTemplate(template)); setError(""); setMessage(""); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingTemplate(null); }
  function updateItem(index, field, value) { setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) })); }
  function selectCatalogItem(index, name) {
    const product = catalog.find((item) => item.name === name);
    if (!product) { updateItem(index, "productName", name); return; }
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, productName: product.name, preparation: product.preparation, application: product.application, route: product.route } : item) }));
  }
  function addItem() { setForm((current) => ({ ...current, items: [...current.items, emptyItem()] })); }
  function removeItem(index) { setForm((current) => ({ ...current, items: current.items.filter((_item, itemIndex) => itemIndex !== index) })); }

  async function submit(event) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      if (!form.items.length) { setError("Adicione pelo menos um produto ao modelo."); return; }
      const action = editingTemplate ? api.updatePlanTemplate(editingTemplate.id, form) : api.createPlanTemplate(form);
      await action; closeModal(); setMessage(editingTemplate ? "Modelo atualizado." : "Modelo criado."); await loadData();
    } catch (err) { setError(err.message); }
  }
  async function removeTemplate(template) {
    if (!window.confirm(`Excluir o modelo “${template.name}”?`)) return;
    setError(""); setMessage("");
    try { await api.deletePlanTemplate(template.id); setMessage("Modelo excluído."); await loadData(); } catch (err) { setError(err.message); }
  }

  return <div className="app-frame"><main className="page-shell">
    <section className="page-heading"><div><p className="eyebrow">Administração</p><h1>Modelos de planos</h1><p className="page-subtitle">Produtos prescritos, preparo e preço definidos pelo administrador.</p></div><button className="primary-button" type="button" onClick={openCreate}>Novo modelo</button></section>
    <section className="panel"><div className="panel-header"><div><h2>Modelos globais</h2><p>Os produtos são selecionados a partir das referências do BioO3 Lab.</p></div></div>{error && !modalOpen && <p className="form-error">{error}</p>}{message && !modalOpen && <p className="form-success">{message}</p>}{loading && <TableSkeleton columns={5} rows={5} />}{!loading && <div className="table-wrap"><table className="control-table templates-table"><thead><tr><th>Modelo</th><th>Frequência</th><th>Sessões padrão</th><th>Produtos</th><th>Ações</th></tr></thead><tbody>{templates.map((template) => <tr key={template.id}><td><strong className="strong-cell">{template.name}</strong>{template.description && <small>{template.description}</small>}</td><td>{frequencies[template.frequency] || template.frequency}</td><td className="center">{template.sessions}</td><td>{template.items.length}</td><td><div className="row-actions"><ActionButton action="edit" iconOnly onClick={() => openEdit(template)} aria-label={`Editar ${template.name}`} /><ActionButton action="delete" iconOnly onClick={() => removeTemplate(template)} aria-label={`Excluir ${template.name}`} /></div></td></tr>)}{!templates.length && <tr><td colSpan="5"><div className="empty-state compact-empty">Nenhum modelo cadastrado.</div></td></tr>}</tbody></table></div>}</section>
  </main>
  {modalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="template-modal-title"><div className="modal-card template-modal-card"><button className="modal-close" type="button" onClick={closeModal} aria-label="Fechar">×</button><h2 id="template-modal-title">{editingTemplate ? "Editar modelo" : "Novo modelo"}</h2><form className="form-grid" onSubmit={submit}><label><span>Nome do modelo</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label><span>Frequência padrão</span><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>{Object.entries(frequencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Sessões padrão</span><input type="number" min="1" max="100" value={form.sessions} onChange={(e) => setForm({ ...form, sessions: e.target.value })} required /></label><label className="full-width"><span>Descrição</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
  <div className="template-items-field full-width"><div className="template-items-heading"><div><span>Produtos prescritos</span><small>O preço é definido por produto e pode ser ajustado no plano do paciente.</small></div><button className="secondary-button compact-button" type="button" onClick={addItem}>Adicionar produto</button></div><div className="template-item-list">{form.items.map((item, index) => <div className="template-item-row template-item-row-detailed" key={index}><label><span>Produto</span><select value={item.productName} onChange={(e) => selectCatalogItem(index, e.target.value)} required><option value="">Selecione o produto</option>{item.productName && !catalog.some((product) => product.name === item.productName) && <option value={item.productName}>{item.productName}</option>}{catalog.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label><label><span>Via</span><select value={item.route} onChange={(e) => updateItem(index, "route", e.target.value)}>{Object.entries(routes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Quantidade</span><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} required /></label><label><span>Unidade</span><select value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)}>{Object.entries(units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Sessões</span><input type="number" min="1" max="100" value={item.sessions} onChange={(e) => updateItem(index, "sessions", e.target.value)} required /></label><label><span>Intervalo (dias)</span><input type="number" min="1" max="365" value={item.intervalDays} onChange={(e) => updateItem(index, "intervalDays", e.target.value)} required /></label><label><span>Preço unitário (R$)</span><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", e.target.value)} required /></label><label className="full-width"><span>Preparo</span><textarea rows="2" value={item.preparation} onChange={(e) => updateItem(index, "preparation", e.target.value)} /></label><label className="full-width"><span>Aplicação</span><textarea rows="2" value={item.application} onChange={(e) => updateItem(index, "application", e.target.value)} /></label><ActionButton action="delete" onClick={() => removeItem(index)}>Remover produto</ActionButton></div>)}</div></div>{error && <p className="form-error full-width">{error}</p>}<button className="primary-button full-width" type="submit">Salvar modelo</button></form></div></div>}
  </div>;
}
