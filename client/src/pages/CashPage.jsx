import { useEffect, useState } from "react";
import { api } from "../api";
import { SummarySkeleton, TableSkeleton } from "../components/Skeleton";
import ActionButton from "../components/ActionButton";

const emptyLine = () => ({ productId: "", quantity: 1 });
const emptySale = () => ({ source: "MANUAL", patientId: "", patientPlanId: "", discountPercent: 0, installments: 1, items: [emptyLine()] });
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
const sourceLabels = { MANUAL: "Manual", PLAN: "Plano" };
const statusLabels = { OPEN: "Em aberto", PARTIAL: "Parcial", PAID: "Pago", CANCELED: "Cancelado" };
const methods = { CASH: "Dinheiro", PIX: "Pix", CARD: "Cartão", TRANSFER: "Transferência", OTHER: "Outro" };

function statusClass(status) {
  return status === "PAID" ? "active" : status === "CANCELED" ? "muted" : "warning";
}

export default function CashPage() {
  const [products, setProducts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [plans, setPlans] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saleModal, setSaleModal] = useState(false);
  const [paymentSale, setPaymentSale] = useState(null);
  const [detailsSale, setDetailsSale] = useState(null);
  const [saleForm, setSaleForm] = useState(emptySale);
  const [paymentForm, setPaymentForm] = useState({ installmentId: "", amount: "", method: "PIX", notes: "" });
  const activeSales = sales.filter((sale) => sale.status !== "CANCELED");
  const receivedTotal = activeSales.reduce((total, sale) => total + Number(sale.paidAmount || 0), 0);
  const openBalance = activeSales.reduce((total, sale) => total + Number(sale.balance || 0), 0);

  function load() {
    setLoading(true); setError("");
    return Promise.all([api.products(), api.patients(), api.patientPlans(), api.sales()])
      .then(([productData, patientData, planData, saleData]) => {
        setProducts(productData.products || []);
        setPatients(patientData.patients || []);
        setPlans(planData.plans || []);
        setSales(saleData.sales || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openSale() {
    setSaleForm(emptySale()); setMessage(""); setError(""); setSaleModal(true);
  }

  function choosePlan(planId) {
    const plan = plans.find((item) => String(item.id) === String(planId));
    if (!plan) return;
    const items = plan.items.map((item) => {
      const product = products.find((candidate) => candidate.name.toLowerCase() === String(item.productName).toLowerCase());
      return { productId: product?.id || "", quantity: item.quantity || 1 };
    });
    setSaleForm((current) => ({ ...current, source: "PLAN", patientId: plan.patientId, patientPlanId: plan.id, items: items.length ? items : [emptyLine()] }));
  }

  function updateLine(index, field, value) {
    setSaleForm((current) => ({ ...current, items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) }));
  }

  function addLine() { setSaleForm((current) => ({ ...current, items: [...current.items, emptyLine()] })); }
  function removeLine(index) { setSaleForm((current) => ({ ...current, items: current.items.length > 1 ? current.items.filter((_line, lineIndex) => lineIndex !== index) : current.items })); }

  function estimatedSubtotal() {
    return saleForm.items.reduce((sum, line) => {
      const product = products.find((item) => String(item.id) === String(line.productId));
      return sum + Number(product?.salePrice || 0) * Number(line.quantity || 0);
    }, 0);
  }

  async function submitSale(event) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const data = await api.createSale({ ...saleForm, items: saleForm.items.filter((line) => line.productId) });
      setSaleModal(false); setMessage(data.warnings?.length ? `Venda registrada com alerta: ${data.warnings.join(" ")}` : "Venda registrada."); await load();
    } catch (err) { setError(err.message); }
  }

  function openPayment(sale) {
    const installment = sale.installmentRows.find((row) => row.status !== "PAID");
    setPaymentSale(sale); setPaymentForm({ installmentId: installment?.id || "", amount: installment?.amount || sale.balance, method: "PIX", notes: "" }); setError("");
  }

  async function submitPayment(event) {
    event.preventDefault(); setError("");
    try { await api.createPayment(paymentSale.id, paymentForm); setPaymentSale(null); setMessage("Pagamento registrado."); await load(); }
    catch (err) { setError(err.message); }
  }

  function escapeHtml(value = "") {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  async function printReceipt(sale) {
    try {
      const data = await api.createReceipt(sale.id);
      const receipt = data.receipt;
      const printWindow = window.open("", "_blank", "width=900,height=1100");
      if (!printWindow) throw new Error("Não foi possível abrir a janela de impressão.");
      const items = sale.items.map((item) => `<tr><td>${escapeHtml(item.productName)}</td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join("");
      printWindow.document.write(`<!doctype html><html><head><title>Recibo ${escapeHtml(receipt.number)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#122533;font-size:12px}h1,h2{color:#075985}header{display:flex;justify-content:space-between;border-bottom:2px solid #bae6fd;padding-bottom:12px;margin-bottom:18px}table{width:100%;border-collapse:collapse;margin:12px 0 20px}th,td{border:1px solid #d8edf7;padding:8px;text-align:left}th{background:#e0f2fe;color:#075985;font-size:10px;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.box{border:1px solid #d8edf7;border-radius:8px;padding:9px;background:#f0f9ff}.box span{display:block;color:#647888;font-size:10px;text-transform:uppercase}.box strong{display:block;margin-top:4px}.total{margin-left:auto;width:260px}.total div{display:flex;justify-content:space-between;padding:6px 0}.total .final{border-top:2px solid #bae6fd;color:#075985;font-size:15px;font-weight:bold}.split{margin-top:20px;padding:12px;border:1px solid #d8edf7;background:#f0f9ff}</style></head><body><header><div><h1>Recibo BioO3</h1><div>${escapeHtml(receipt.number)}</div></div><div>${new Intl.DateTimeFormat("pt-BR").format(new Date(receipt.issuedAt))}</div></header><div class="grid"><div class="box"><span>Paciente</span><strong>${escapeHtml(sale.patientName || "Venda manual")}</strong></div><div class="box"><span>Clínica</span><strong>${escapeHtml(sale.clinicName || "BioO3")}</strong></div><div class="box"><span>Origem</span><strong>${escapeHtml(sourceLabels[sale.source] || sale.source)}</strong></div></div><h2>Itens</h2><table><thead><tr><th>Produto</th><th>Qtd.</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><div class="total"><div><span>Subtotal</span><strong>${money(receipt.subtotal)}</strong></div><div><span>Desconto</span><strong>${money(receipt.discountAmount)}</strong></div><div class="final"><span>Total</span><strong>${money(receipt.total)}</strong></div></div><div class="split"><strong>Divisão financeira</strong><br>BioO3: ${money(receipt.bioo3Share)}<br>Clínica: ${money(receipt.clinicShare)}</div></body></html>`);
      printWindow.document.close();
      printWindow.addEventListener("load", () => printWindow.print());
      setDetailsSale({ ...sale, receipt: { ...sale.receipt, ...receipt } });
    } catch (err) { setError(err.message); }
  }

  async function requestFiscal(sale) {
    try {
      const data = await api.requestFiscalDocument(sale.id);
      setMessage(data.message || "Documento fiscal pendente de configuração.");
      setDetailsSale({ ...sale, fiscalDocument: data.fiscalDocument });
      await load();
    } catch (err) { setError(err.message); }
  }

  return <div className="app-frame"><main className="page-shell">
    <section className="page-heading"><div><p className="eyebrow">Caixa</p><h1>Vendas e pagamentos</h1><p className="page-subtitle">Vendas manuais ou originadas de planos, com histórico financeiro por clínica.</p></div><button className="primary-button" type="button" onClick={openSale}>Nova venda</button></section>
    {(error || message) && <section className="panel cash-feedback"><p className={error ? "form-error" : "form-success"}>{error || message}</p></section>}
    <section className="panel">{loading ? <SummarySkeleton className="table-summary" /> : <div className="summary-grid table-summary"><div><strong>{sales.length}</strong><span>Vendas registradas</span></div><div><strong>{money(receivedTotal)}</strong><span>Total recebido</span></div><div><strong>{money(openBalance)}</strong><span>Saldo em aberto</span></div></div>}{loading ? <TableSkeleton columns={8} /> : <div className="table-wrap"><table className="control-table cash-table"><thead><tr><th>Data</th><th>Clínica</th><th>Origem</th><th>Paciente</th><th>Subtotal</th><th>Desconto</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{new Intl.DateTimeFormat("pt-BR").format(new Date(sale.createdAt))}</td><td>{sale.clinicName || "—"}</td><td>{sourceLabels[sale.source] || sale.source}{sale.patientPlanName && <small className="movement-context">{sale.patientPlanName}</small>}</td><td>{sale.patientName || "Venda manual"}</td><td>{money(sale.subtotal)}</td><td>{sale.discountPercent}%</td><td className="strong-cell">{money(sale.total)}</td><td><span className={`status-pill ${statusClass(sale.status)}`}>{statusLabels[sale.status] || sale.status}</span><small className="movement-context">Saldo: {money(sale.balance)}</small></td><td><div className="row-actions"><button className="secondary-button compact-button" type="button" onClick={() => setDetailsSale(sale)}>Detalhes</button>{sale.status !== "PAID" && sale.status !== "CANCELED" && <button className="primary-button compact-button" type="button" onClick={() => openPayment(sale)}>Pagamento</button>}</div></td></tr>)}{!sales.length && <tr><td colSpan="9"><div className="empty-state compact-empty">Nenhuma venda registrada.</div></td></tr>}</tbody></table></div>}</section>
  </main>

  {saleModal && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card cash-modal"><button className="modal-close" type="button" onClick={() => setSaleModal(false)}>×</button><h2>Nova venda</h2><form className="form-grid" onSubmit={submitSale}><label><span>Origem</span><select value={saleForm.source} onChange={(e) => setSaleForm({ ...saleForm, source: e.target.value, patientPlanId: "" })}><option value="MANUAL">Venda manual</option><option value="PLAN">Venda de plano</option></select></label><label><span>Paciente (opcional)</span><select value={saleForm.patientId} onChange={(e) => setSaleForm({ ...saleForm, patientId: e.target.value })}><option value="">Não informado</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>{saleForm.source === "PLAN" && <label className="full-width"><span>Plano</span><select value={saleForm.patientPlanId} onChange={(e) => choosePlan(e.target.value)} required><option value="">Selecione o plano</option>{plans.filter((plan) => plan.status !== "CANCELED").map((plan) => <option key={plan.id} value={plan.id}>{plan.patientName} · {plan.name}</option>)}</select></label>}<div className="full-width cash-line-items"><div className="cash-line-heading"><span>Produtos</span><button className="secondary-button compact-button" type="button" onClick={addLine}>Adicionar produto</button></div>{saleForm.items.map((line, index) => <div className="cash-line" key={index}><select value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)} required><option value="">Produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.salePrice)}</option>)}</select><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} required /><ActionButton action="delete" iconOnly onClick={() => removeLine(index)} aria-label="Remover produto" /></div>)}</div><label><span>Desconto (%)</span><input type="number" min="0" max="100" step="0.01" value={saleForm.discountPercent} onChange={(e) => setSaleForm({ ...saleForm, discountPercent: e.target.value })} /></label><label><span>Parcelas</span><input type="number" min="1" max="60" value={saleForm.installments} onChange={(e) => setSaleForm({ ...saleForm, installments: e.target.value })} /></label><div className="cash-total full-width"><span>Subtotal estimado</span><strong>{money(estimatedSubtotal())}</strong></div><button className="primary-button full-width" type="submit">Registrar venda</button></form></div></div>}

  {paymentSale && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card cash-modal"><button className="modal-close" type="button" onClick={() => setPaymentSale(null)}>×</button><h2>Registrar pagamento</h2><p className="muted-text">Venda #{paymentSale.id} · Saldo {money(paymentSale.balance)}</p><form className="form-grid" onSubmit={submitPayment}><label><span>Parcela</span><select value={paymentForm.installmentId} onChange={(e) => setPaymentForm({ ...paymentForm, installmentId: e.target.value })} required>{paymentSale.installmentRows.filter((row) => row.status !== "PAID").map((row) => <option key={row.id} value={row.id}>Parcela {row.number} · {money(row.amount)}</option>)}</select></label><label><span>Valor</span><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required /></label><label><span>Método</span><select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>{Object.entries(methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="full-width"><span>Observações</span><input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></label><button className="primary-button full-width" type="submit">Registrar pagamento</button></form></div></div>}

  {detailsSale && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card cash-modal cash-detail-modal"><button className="modal-close" type="button" onClick={() => setDetailsSale(null)}>×</button><h2>Venda #{detailsSale.id}</h2><p className="muted-text">{detailsSale.patientName || "Venda manual"} · {money(detailsSale.total)} · {statusLabels[detailsSale.status]}</p><div className="cash-document-actions"><button className="secondary-button" type="button" onClick={() => printReceipt(detailsSale)}>Recibo PDF</button><button className="secondary-button" type="button" onClick={() => requestFiscal(detailsSale)}>Solicitar nota BioO3</button></div><h3>Produtos</h3><div className="table-wrap"><table className="control-table"><thead><tr><th>Produto</th><th>Qtd.</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>{detailsSale.items.map((item) => <tr key={item.id}><td>{item.productName}</td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.total)}</td></tr>)}</tbody></table></div><h3>Parcelas e pagamentos</h3><div className="installment-list">{detailsSale.installmentRows.map((row) => <div key={row.id}><span>Parcela {row.number}</span><strong>{money(row.amount)}</strong><em>{row.status === "PAID" ? "Paga" : row.status === "PARTIAL" ? "Parcial" : "Pendente"}</em></div>)}</div>{detailsSale.receipt && <div className="cash-document-status"><strong>Recibo: {detailsSale.receipt.number}</strong><span>BioO3: {money(detailsSale.receipt.bioo3Share)} · Clínica: {money(detailsSale.receipt.clinicShare)}</span></div>}{detailsSale.fiscalDocument && <div className="cash-document-status"><strong>Documento fiscal BioO3: {detailsSale.fiscalDocument.status}</strong><span>{detailsSale.fiscalDocument.error || `Valor: ${money(detailsSale.fiscalDocument.amount)}`}</span></div>}{detailsSale.payments.length > 0 && <p className="muted-text">{detailsSale.payments.length} pagamento(s) registrado(s).</p>}</div></div>}
  </div>;
}
