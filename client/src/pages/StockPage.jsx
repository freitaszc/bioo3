import { useEffect, useState } from "react";
import { api } from "../api";
import { TableSkeleton } from "../components/Skeleton";
import ActionButton from "../components/ActionButton";

const emptyProduct = {
  name: "",
  quantity: "",
  purchasePrice: "",
  salePrice: ""
};

const emptySupplier = { name: "", contact: "", phone: "", email: "", notes: "" };
const emptyLot = { productId: "", supplierId: "", batchNumber: "", expiresAt: "", quantity: "", reason: "" };
const emptyMovement = { productId: "", lotId: "", type: "SALE", quantity: "", reason: "", patientId: "", patientPlanId: "" };
const movementTypes = { RECEIPT: "Entrada", REMOVAL: "Saída", SALE: "Venda", PLAN_CONSUMPTION: "Consumo por plano", ADJUSTMENT: "Ajuste manual" };

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [suppliers, setSuppliers] = useState([]);
  const [lots, setLots] = useState([]);
  const [movements, setMovements] = useState([]);
  const [advancedModal, setAdvancedModal] = useState(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [lotForm, setLotForm] = useState(emptyLot);
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [advancedMessage, setAdvancedMessage] = useState("");
  const [advancedError, setAdvancedError] = useState("");

  function loadProducts(filters = { search, status }) {
    setLoading(true);
    setError("");
    return api.products(filters)
      .then((data) => {
        setProducts(data.products || []);
        setSelectedIds([]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts({ search: "", status: "" });
    loadAdvanced();
  }, []);

  function loadAdvanced() {
    return Promise.all([api.suppliers(), api.stockLots(), api.stockMovements()])
      .then(([supplierData, lotData, movementData]) => {
        setSuppliers(supplierData.suppliers || []);
        setLots(lotData.lots || []);
        setMovements(movementData.movements || []);
      })
      .catch((err) => setError(err.message));
  }

  function openAdvancedModal(mode) {
    setAdvancedModal(mode);
    setAdvancedError("");
    setAdvancedMessage("");
    if (mode === "supplier") setSupplierForm(emptySupplier);
    if (mode === "lot") setLotForm({ ...emptyLot, productId: products[0]?.id || "" });
    if (mode === "movement") setMovementForm({ ...emptyMovement, productId: products[0]?.id || "" });
    if (mode === "history") loadAdvanced();
  }

  async function submitSupplier(event) {
    event.preventDefault(); setAdvancedError("");
    try { await api.createSupplier(supplierForm); setSupplierForm(emptySupplier); await loadAdvanced(); setAdvancedMessage("Fornecedor cadastrado."); }
    catch (err) { setAdvancedError(err.message); }
  }

  async function deleteSupplier(supplier) {
    if (!window.confirm(`Excluir o fornecedor ${supplier.name}?`)) return;
    try { await api.deleteSupplier(supplier.id); await loadAdvanced(); }
    catch (err) { setAdvancedError(err.message); }
  }

  async function submitLot(event) {
    event.preventDefault(); setAdvancedError(""); setAdvancedMessage("");
    try {
      await api.createStockLot(lotForm);
      await Promise.all([loadProducts(), loadAdvanced()]);
      setAdvancedMessage("Lote cadastrado e entrada registrada.");
      setLotForm(emptyLot);
    } catch (err) { setAdvancedError(err.message); }
  }

  async function submitMovement(event) {
    event.preventDefault(); setAdvancedError(""); setAdvancedMessage("");
    try {
      const data = await api.createStockMovement(movementForm);
      await Promise.all([loadProducts(), loadAdvanced()]);
      setAdvancedMessage(data.warnings?.length ? `Movimentação registrada com alerta: ${data.warnings.join(" ")}` : "Movimentação registrada.");
      setMovementForm(emptyMovement);
    } catch (err) { setAdvancedError(err.message); }
  }

  function openCreate() {
    setEditingProduct(null);
    setForm(emptyProduct);
    setModalMode("create");
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      quantity: product.quantity || "",
      purchasePrice: product.purchasePrice || "",
      salePrice: product.salePrice || ""
    });
    setModalMode("edit");
  }

  function submitProduct(event) {
    event.preventDefault();
    const action = editingProduct
      ? api.updateProduct(editingProduct.id, form)
      : api.createProduct(form);

    action
      .then(() => {
        setModalMode(null);
        setEditingProduct(null);
        setForm(emptyProduct);
        return loadProducts();
      })
      .catch((err) => setError(err.message));
  }

  function toggleSelection(id) {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleAll() {
    setSelectedIds((current) => (
      current.length === products.length ? [] : products.map((product) => product.id)
    ));
  }

  function deleteSelected() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Remover ${selectedIds.length} produto(s) selecionado(s)?`)) return;
    api.deleteProducts(selectedIds)
      .then(() => loadProducts())
      .catch((err) => setError(err.message));
  }

  function toggleStatus(product) {
    const nextStatus = product.status === "Ativo" ? "Inativo" : "Ativo";
    api.updateProductStatus(product.id, nextStatus)
      .then(() => loadProducts())
      .catch((err) => setError(err.message));
  }

  function handleFilter(event) {
    event.preventDefault();
    loadProducts({ search, status });
  }

  return (
    <div className="app-frame">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Estoque</p>
            <h1>Controle de estoque</h1>
            <p className="page-subtitle">Produtos, quantidades e valores comerciais.</p>
          </div>
          <div className="inventory-toolbar">
            <button className="primary-button" type="button" onClick={openCreate}>Cadastrar produto</button>
            <button className="secondary-button" type="button" onClick={() => openAdvancedModal("lot")}>Entrada de lote</button>
            <button className="secondary-button" type="button" onClick={() => openAdvancedModal("movement")}>Movimentar estoque</button>
          </div>
        </section>

        <section className="panel">
          <form className="filter-bar" onSubmit={handleFilter}>
            <input type="search" placeholder="Pesquisar produto..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
            <button className="secondary-button" type="submit">Filtrar</button>
          </form>

          <div className="bulk-actions">
            <span>{selectedIds.length} selecionado(s)</span>
            <button className="danger-button" type="button" onClick={deleteSelected} disabled={!selectedIds.length}>
              Apagar selecionados
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading && <TableSkeleton columns={8} />}
          {!loading && !error && (
            <div className="table-wrap">
              <table className="control-table stock-table">
                <thead>
                  <tr>
                    <th className="center"><input type="checkbox" checked={products.length > 0 && selectedIds.length === products.length} onChange={toggleAll} /></th>
                    <th>Produto</th>
                    <th>Clínica</th>
                    <th>Qtd.</th>
                    <th>Compra</th>
                    <th>Venda</th>
                    <th>Status</th>
                    <th className="center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="center"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleSelection(product.id)} /></td>
                      <td className="strong-cell">{product.name}</td>
                      <td>{product.clinicName || "—"}</td>
                      <td className="center">{product.quantity}</td>
                      <td className="center">{currency(product.purchasePrice)}</td>
                      <td className="center">{currency(product.salePrice)}</td>
                      <td className="center">
                        <button className={`status-pill ${product.status === "Ativo" ? "active" : "muted"}`} type="button" onClick={() => toggleStatus(product)}>
                          {product.status}
                        </button>
                      </td>
                      <td className="center"><ActionButton action="edit" iconOnly onClick={() => openEdit(product)} aria-label={`Editar ${product.name}`} /></td>
                    </tr>
                  ))}
                  {!products.length && <tr><td colSpan="8"><div className="empty-state compact-empty">Nenhum produto cadastrado.</div></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel inventory-summary-panel">
          <div className="panel-header"><div><h2>Inventário avançado</h2><p>{lots.length} lote(s) e {movements.length} movimentação(ões) registradas.</p></div><div className="inventory-toolbar"><button className="secondary-button" type="button" onClick={() => openAdvancedModal("supplier")}>Fornecedores</button><button className="secondary-button" type="button" onClick={() => openAdvancedModal("history")}>Ver histórico</button></div></div>
          {advancedMessage && <p className="form-success">{advancedMessage}</p>}
          {advancedError && !advancedModal && <p className="form-error">{advancedError}</p>}
          <div className="inventory-summary-grid"><div><strong>{suppliers.length}</strong><span>Fornecedores</span></div><div><strong>{lots.length}</strong><span>Lotes</span></div><div><strong>{movements.length}</strong><span>Movimentações recentes</span></div></div>
        </section>
      </main>

      {modalMode && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={() => setModalMode(null)}>×</button>
            <h2>{modalMode === "edit" ? "Editar produto" : "Cadastrar produto"}</h2>
            <form className="form-grid" onSubmit={submitProduct}>
              <label><span>Produto</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label><span>Quantidade</span><input type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></label>
              <label><span>Preço de compra</span><input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} required /></label>
              <label><span>Preço de venda</span><input type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} required /></label>
              <button className="secondary-button stock-save-button" type="submit">Salvar produto</button>
            </form>
          </div>
        </div>
      )}

      {advancedModal === "supplier" && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card inventory-modal"><button className="modal-close" type="button" onClick={() => setAdvancedModal(null)}>×</button><h2>Fornecedores</h2><form className="form-grid" onSubmit={submitSupplier}><label><span>Nome</span><input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required /></label><label><span>Contato</span><input value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} /></label><label><span>Telefone</span><input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label><label><span>E-mail</span><input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></label><label className="full-width"><span>Observações</span><textarea rows="3" value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} /></label>{advancedError && <p className="form-error full-width">{advancedError}</p>}<button className="primary-button fit-button" type="submit">Cadastrar fornecedor</button></form><div className="inventory-list">{suppliers.map((supplier) => <div className="inventory-list-row" key={supplier.id}><div><strong>{supplier.name}</strong><small>{supplier.phone || supplier.email || "Sem contato informado"}</small></div><ActionButton action="delete" iconOnly onClick={() => deleteSupplier(supplier)} aria-label={`Excluir ${supplier.name}`} /></div>)}{!suppliers.length && <p className="muted-text">Nenhum fornecedor cadastrado.</p>}</div></div></div>}

      {advancedModal === "lot" && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card inventory-modal"><button className="modal-close" type="button" onClick={() => setAdvancedModal(null)}>×</button><h2>Entrada de lote</h2><p className="muted-text">A entrada atualiza o estoque do produto e registra uma movimentação.</p><form className="form-grid" onSubmit={submitLot}><label><span>Produto</span><select value={lotForm.productId} onChange={(e) => setLotForm({ ...lotForm, productId: e.target.value })} required><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label><span>Fornecedor</span><select value={lotForm.supplierId} onChange={(e) => setLotForm({ ...lotForm, supplierId: e.target.value })}><option value="">Não informado</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label><span>Lote</span><input value={lotForm.batchNumber} onChange={(e) => setLotForm({ ...lotForm, batchNumber: e.target.value })} required /></label><label><span>Validade</span><input type="date" value={lotForm.expiresAt} onChange={(e) => setLotForm({ ...lotForm, expiresAt: e.target.value })} required /></label><label><span>Quantidade</span><input type="number" min="1" value={lotForm.quantity} onChange={(e) => setLotForm({ ...lotForm, quantity: e.target.value })} required /></label><label className="full-width"><span>Motivo</span><input value={lotForm.reason} onChange={(e) => setLotForm({ ...lotForm, reason: e.target.value })} placeholder="Entrada de compra, reposição..." /></label>{advancedError && <p className="form-error full-width">{advancedError}</p>}<button className="primary-button fit-button" type="submit">Registrar entrada</button></form></div></div>}

      {advancedModal === "movement" && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card inventory-modal"><button className="modal-close" type="button" onClick={() => setAdvancedModal(null)}>×</button><h2>Movimentar estoque</h2><p className="muted-text">Vendas e consumos não são bloqueados por estoque insuficiente ou lote vencido; um alerta será exibido.</p><form className="form-grid" onSubmit={submitMovement}><label><span>Produto</span><select value={movementForm.productId} onChange={(e) => setMovementForm({ ...movementForm, productId: e.target.value, lotId: "" })} required><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · estoque {product.quantity}</option>)}</select></label><label><span>Tipo</span><select value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}>{Object.entries(movementTypes).filter(([value]) => value !== "RECEIPT").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Lote</span><select value={movementForm.lotId} onChange={(e) => setMovementForm({ ...movementForm, lotId: e.target.value })}><option value="">Nenhum lote específico</option>{lots.filter((lot) => String(lot.productId) === String(movementForm.productId)).map((lot) => <option key={lot.id} value={lot.id}>{lot.batchNumber} · saldo {lot.quantity}</option>)}</select></label><label><span>Quantidade</span><input type="number" min="1" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} required /></label><label><span>Paciente ID (opcional)</span><input type="number" min="1" value={movementForm.patientId} onChange={(e) => setMovementForm({ ...movementForm, patientId: e.target.value })} /></label><label><span>Plano ID (opcional)</span><input type="number" min="1" value={movementForm.patientPlanId} onChange={(e) => setMovementForm({ ...movementForm, patientPlanId: e.target.value })} /></label><label className="full-width"><span>Motivo</span><input value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} placeholder="Obrigatório para saída, consumo e ajuste" /></label>{advancedError && <p className="form-error full-width">{advancedError}</p>}<button className="primary-button fit-button" type="submit">Registrar movimentação</button></form></div></div>}

      {advancedModal === "history" && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card inventory-history-modal"><button className="modal-close" type="button" onClick={() => setAdvancedModal(null)}>×</button><h2>Histórico de estoque</h2><div className="table-wrap"><table className="control-table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Motivo</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Intl.DateTimeFormat("pt-BR").format(new Date(movement.createdAt))}</td><td>{movement.productName}</td><td>{movement.typeLabel}</td><td>{movement.quantity}</td><td>{movement.reason || "—"}{movement.patientName && <small className="movement-context">Paciente: {movement.patientName}</small>}{movement.patientPlanName && <small className="movement-context">Plano: {movement.patientPlanName}</small>}</td></tr>)}{!movements.length && <tr><td colSpan="5"><div className="empty-state compact-empty">Nenhuma movimentação registrada.</div></td></tr>}</tbody></table></div></div></div>}
    </div>
  );
}
