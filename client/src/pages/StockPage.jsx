import { useEffect, useState } from "react";
import { api } from "../api";
import { TableSkeleton } from "../components/Skeleton";
import Topbar from "../components/Topbar";

const emptyProduct = {
  name: "",
  quantity: "",
  purchasePrice: "",
  salePrice: ""
};

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
  }, []);

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
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Estoque</p>
            <h1>Controle de estoque</h1>
            <p className="page-subtitle">Produtos, quantidades e valores comerciais.</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreate}>Cadastrar produto</button>
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
                      <td className="center"><button className="secondary-button compact-button" type="button" onClick={() => openEdit(product)}>Editar</button></td>
                    </tr>
                  ))}
                  {!products.length && <tr><td colSpan="8"><div className="empty-state compact-empty">Nenhum produto cadastrado.</div></td></tr>}
                </tbody>
              </table>
            </div>
          )}
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
    </div>
  );
}
