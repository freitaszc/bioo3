import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { TableSkeleton } from "../components/Skeleton";

const emptyClinic = { id: null, name: "", whatsappPhone: "", status: "ACTIVE" };
const statusLabels = { ACTIVE: "Ativa", SUSPENDED: "Inativa", PENDING: "Inativa", REJECTED: "Inativa" };
const digitsOnly = (value) => String(value || "").replace(/\D/g, "").slice(0, 15);

export default function ClinicsPage() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(emptyClinic);
  const [editing, setEditing] = useState(false);
  const [connection, setConnection] = useState(null);
  const [connectionTest, setConnectionTest] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const signupCode = useRef("");
  const signupData = useRef(null);

  function load(status = filter) {
    setError("");
    setLoading(true);
    return Promise.all([api.clinics(status), api.whatsappConnection()])
      .then(([clinicData, whatsappData]) => {
        setClinics(clinicData.clinics || []);
        setConnection(whatsappData.connection || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(""); }, []);

  useEffect(() => {
    if (!connection?.appId || document.getElementById("facebook-jssdk")) return;
    window.fbAsyncInit = () => window.FB?.init({ appId: connection.appId, cookie: true, xfbml: false, version: connection.graphVersion || "v23.0" });
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [connection?.appId]);

  useEffect(() => {
    async function finishConnection() {
      if (!signupCode.current || !signupData.current) return;
      const payload = { code: signupCode.current, ...signupData.current };
      signupCode.current = "";
      signupData.current = null;
      setSaving(true);
      try {
        const data = await api.connectWhatsapp(payload);
        setConnection(data.connection);
        setMessage("WhatsApp remetente conectado.");
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }

    function receiveMessage(event) {
      if (!event.origin.endsWith("facebook.com")) return;
      let data = event.data;
      try { if (typeof data === "string") data = JSON.parse(data); } catch { return; }
      if (data?.type !== "WA_EMBEDDED_SIGNUP" || data?.event !== "FINISH") return;
      signupData.current = {
        businessAccountId: data.data?.waba_id || "",
        phoneNumberId: data.data?.phone_number_id || "",
        displayPhone: data.data?.display_phone_number || ""
      };
      finishConnection();
    }
    window.addEventListener("message", receiveMessage);
    window.__bioo3FinishWhatsapp = finishConnection;
    return () => {
      window.removeEventListener("message", receiveMessage);
      delete window.__bioo3FinishWhatsapp;
    };
  }, []);

  if (user?.role !== "ADMIN") return <Navigate to="/inicio" replace />;

  async function saveClinic(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      if (form.id) await api.updateClinic(form.id, form);
      else await api.createClinic(form);
      setForm(emptyClinic); setEditing(false); setMessage(form.id ? "Clínica atualizada." : "Clínica criada.");
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function openClinic(clinic = null) {
    setForm(clinic ? {
      id: clinic.id,
      name: clinic.name,
      whatsappPhone: clinic.whatsappPhone || "",
      status: clinic.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"
    } : emptyClinic);
    setEditing(true); setError(""); setMessage("");
  }

  async function setStatus(clinic) {
    setError(""); setMessage("");
    try {
      await api.setClinicStatus(clinic.id, clinic.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
      setMessage(clinic.status === "ACTIVE" ? "Clínica inativada." : "Clínica ativada.");
      await load();
    } catch (err) { setError(err.message); }
  }

  async function removeClinic(clinic) {
    if (!window.confirm(`Excluir a clínica ${clinic.name}? Clínicas com histórico serão apenas inativadas.`)) return;
    try { await api.deleteClinic(clinic.id); setMessage("Clínica excluída."); await load(); }
    catch (err) { setError(err.message); }
  }

  function connectWhatsapp() {
    setError(""); setMessage("");
    if (!connection?.appId || !connection?.configurationId) {
      setError("Configure META_APP_ID e META_EMBEDDED_SIGNUP_CONFIG_ID no servidor.");
      return;
    }
    if (!window.FB) { setError("O SDK da Meta ainda está carregando. Tente novamente."); return; }
    window.FB.login((response) => {
      if (!response.authResponse?.code) { setError("A conexão com a Meta não foi concluída."); return; }
      signupCode.current = response.authResponse.code;
      window.__bioo3FinishWhatsapp?.();
    }, {
      config_id: connection.configurationId,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {} }
    });
  }

  async function testWhatsapp() {
    try { const data = await api.testWhatsapp(); setConnectionTest(data); setMessage("Conexão validada pela Meta."); }
    catch (err) { setError(err.message); }
  }

  async function disconnectWhatsapp() {
    if (!window.confirm("Desconectar o WhatsApp remetente?")) return;
    try { const data = await api.disconnectWhatsapp(); setConnection(data.connection); setConnectionTest(null); setMessage("WhatsApp desconectado."); }
    catch (err) { setError(err.message); }
  }

  return <div className="app-frame"><main className="page-shell">
    <section className="page-heading"><div><p className="eyebrow">Administração</p><h1>Clínicas</h1><p className="page-subtitle">Organize pacientes por clínica e configure os destinos do WhatsApp.</p></div><button className="primary-button" type="button" onClick={() => openClinic()}>Nova clínica</button></section>

    <section className="panel whatsapp-connection-panel">
      <div className="panel-header"><div><h2>WhatsApp remetente</h2><p>Um único WhatsApp Business da BioO3 envia os relatórios para as clínicas.</p></div><span className={`status-pill ${connection?.status === "CONNECTED" ? "active" : "muted"}`}>{connection?.status === "CONNECTED" ? "Conectado" : "Desconectado"}</span></div>
      {connection?.status === "CONNECTED" ? <div className="whatsapp-connection-actions"><strong>{connection.displayPhone || "Número conectado"}</strong><button className="secondary-button" type="button" onClick={testWhatsapp}>Testar conexão</button><button className="danger-button" type="button" onClick={disconnectWhatsapp}>Desconectar</button></div> : <button className="primary-button fit-button" type="button" disabled={saving} onClick={connectWhatsapp}>{saving ? "Conectando..." : "Conectar pela Meta"}</button>}
      {connectionTest && <p className="muted-text">{connectionTest.verifiedName || "Conta verificada"} · Qualidade: {connectionTest.qualityRating || "não informada"}</p>}
    </section>

    <section className="panel">
      <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); load(); }}><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todas</option><option value="ACTIVE">Ativas</option><option value="SUSPENDED">Inativas</option></select><button className="secondary-button">Filtrar</button></form>
      {error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}
      {loading && <TableSkeleton columns={4} rows={5} />}
      {!loading && <div className="table-wrap"><table className="control-table clinics-table"><thead><tr><th>Clínica</th><th>WhatsApp destinatário</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {clinics.map((clinic) => <tr key={clinic.id}><td><strong>{clinic.name}</strong></td><td>{clinic.whatsappPhone ? `+${clinic.whatsappPhone}` : "Não informado"}</td><td><span className={`status-pill ${clinic.status === "ACTIVE" ? "active" : "muted"}`}>{statusLabels[clinic.status] || "Inativa"}</span></td><td><div className="row-actions"><button className="secondary-button compact-button" type="button" onClick={() => openClinic(clinic)}>Editar</button><button className="secondary-button compact-button" type="button" onClick={() => setStatus(clinic)}>{clinic.status === "ACTIVE" ? "Inativar" : "Ativar"}</button><button className="danger-button compact-button" type="button" onClick={() => removeClinic(clinic)}>Excluir</button></div></td></tr>)}
        {!clinics.length && <tr><td colSpan="4"><div className="empty-state compact-empty">Nenhuma clínica encontrada.</div></td></tr>}
      </tbody></table></div>}
    </section>

    {editing && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><button className="modal-close" type="button" onClick={() => setEditing(false)}>×</button><h2>{form.id ? "Editar clínica" : "Nova clínica"}</h2><form className="form-grid" onSubmit={saveClinic}><label className="full-width"><span>Nome</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label><span>WhatsApp destinatário</span><input inputMode="tel" value={form.whatsappPhone} onChange={(event) => setForm({ ...form, whatsappPhone: digitsOnly(event.target.value) })} placeholder="31999999999" required /></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Ativa</option><option value="SUSPENDED">Inativa</option></select></label><div className="modal-actions full-width"><button className="secondary-button" type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div></form></div></div>}
  </main></div>;
}
