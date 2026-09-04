import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { api, apiAssetUrl } from "../api";
import { useAuth } from "../AuthContext";
import { TableSkeleton } from "../components/Skeleton";
import ActionButton from "../components/ActionButton";

const emptyManual = {
  name: "",
  age: "",
  cpf: "",
  gender: "",
  phone: "",
  doctor: "",
  labResults: ""
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const emptyDoctor = { id: null, name: "", phone: "", councilType: "", councilNumber: "" };
const digitsOnly = (value, maxLength) => String(value || "").replace(/\D/g, "").slice(0, maxLength);
const uppercase = (value) => String(value || "").toLocaleUpperCase("pt-BR");
const batchStatusLabels = { QUEUED: "Na fila", PROCESSING: "Processando", REVIEW: "Aguardando confirmação", CONFIRMED: "Confirmado", FAILED: "Falhou" };
const resultStatusLabels = { LOW: "Baixo", NORMAL: "Normal", HIGH: "Alto", MISSING: "Não encontrado" };
const deliveryStatusLabels = { QUEUED: "Na fila", SENDING: "Enviando", SENT: "Enviado", DELIVERED: "Entregue", READ: "Lido", FAILED: "Falhou" };

function batchResult(analysis, testName) {
  return (analysis?.results || []).find((result) => result.testName === testName) || { testName, value: null, status: "MISSING" };
}

function conflictingValues(result) {
  return result?.conflictingValues || [];
}

function batchOptionLabel(batch) {
  const createdAt = new Date(batch.createdAt);
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(createdAt);
  const time = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(createdAt);
  const count = batch.candidateCount || 0;
  return `${date} às ${time} · ${count} paciente${count === 1 ? "" : "s"}`;
}

export default function BioO3LabPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const linkedPatientParam = searchParams.get("patientId");
  const linkedClinicParam = searchParams.get("clinicId");
  const linkedPatientId = linkedPatientParam ? Number(linkedPatientParam) : null;
  const linkedClinicId = linkedClinicParam ? Number(linkedClinicParam) : null;
  const [linkedPatient, setLinkedPatient] = useState(null);
  const [mode, setMode] = useState("upload");
  const [manual, setManual] = useState(emptyManual);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorDraft, setDoctorDraft] = useState(emptyDoctor);
  const [doctorModal, setDoctorModal] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(true);
  const [doctorSubmitting, setDoctorSubmitting] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [batchFiles, setBatchFiles] = useState([]);
  const [batches, setBatches] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchAnalysis, setBatchAnalysis] = useState(null);
  const [references, setReferences] = useState([]);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referenceModal, setReferenceModal] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshDoctors() {
    setDoctorLoading(true);
    try { const data = await api.doctors(); setDoctors(data.doctors || []); }
    finally { setDoctorLoading(false); }
  }

  useEffect(() => {
    refreshDoctors().catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (!Number.isInteger(linkedPatientId)) return;
    api.patient(linkedPatientId)
      .then((data) => {
        const patient = data.patient;
        setLinkedPatient(patient);
        setManual({
          name: patient.name || "",
          age: patient.age || "",
          cpf: patient.cpf || "",
          gender: patient.gender || "",
          phone: patient.phone || "",
          doctor: patient.doctorName || "",
          labResults: ""
        });
      })
      .catch((err) => setError(err.message));
  }, [linkedPatientId]);

  async function refreshBatches() {
    const data = await api.labBatches();
    const next = data.batches || [];
    setBatches(next);
    setActiveBatchId((current) => current || next[0]?.id || "");
    return next;
  }

  useEffect(() => {
    if (mode !== "batch") return undefined;
    refreshBatches().catch((err) => setError(err.message));
    const timer = window.setInterval(() => refreshBatches().catch(() => {}), 3000);
    return () => window.clearInterval(timer);
  }, [mode]);

  async function saveDoctor(event) {
    event.preventDefault();
    setDoctorError("");
    setMessage("");
    setDoctorSubmitting(true);
    try {
      if (doctorDraft.id) await api.updateDoctor(doctorDraft.id, doctorDraft);
      else await api.createDoctor(doctorDraft);
      const edited = Boolean(doctorDraft.id);
      setDoctorDraft(emptyDoctor);
      await refreshDoctors();
      setDoctorModal("list");
      setMessage(edited ? "Prescritor atualizado." : "Prescritor cadastrado.");
    } catch (err) {
      setDoctorError(err.message);
    } finally { setDoctorSubmitting(false); }
  }

  async function openReferences() {
    setReferenceModal(true);
    setReferenceLoading(true);
    setReferenceError("");
    try { const data = await api.references(); setReferences(data.references || []); }
    catch (err) { setReferenceError(err.message); }
    finally { setReferenceLoading(false); }
  }

  async function saveReference(reference) {
    try { await api.updateReference(reference.testName, reference.ideal); setMessage(`Referência de ${reference.testName} atualizada.`); }
    catch (err) { setError(err.message); }
  }

  function openDoctorForm(doctor = null) {
    setDoctorError("");
    setDoctorDraft(doctor ? { id: doctor.id, name: doctor.name, phone: doctor.phone, councilType: doctor.councilType, councilNumber: doctor.councilNumber } : emptyDoctor);
    setDoctorModal(doctor ? "edit" : "create");
  }

  async function deleteDoctor(doctor) {
    if (!window.confirm(`Excluir o prescritor ${doctor.name}?`)) return;
    setDoctorError("");
    try { await api.deleteDoctor(doctor.id); await refreshDoctors(); setMessage("Prescritor excluído."); }
    catch (err) { setDoctorError(err.message); }
  }

  async function submitManual(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await api.submitManualLab({
        ...manual,
        ...(Number.isInteger(linkedPatientId) ? { patientId: linkedPatientId, clinicId: linkedClinicId } : {})
      });
      setMessage(response.message);
      setManual(emptyManual);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitUpload(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setAnalysisResult(null);
    if (!selectedFile) {
      setError("Selecione um PDF antes de enviar.");
      return;
    }
    try {
      setUploading(true);
      const data = await fileToDataUrl(selectedFile);
      const response = await api.previewUploadLab({
        filename: selectedFile.name,
        data,
        ...(Number.isInteger(linkedPatientId) ? { patientId: linkedPatientId, clinicId: linkedClinicId } : {})
      });
      setUploadPreview(response);
      setEditingPatient(false);
      setMessage("Dados extraídos. Revise antes de aceitar a análise.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function confirmUploadAnalysis() {
    if (!uploadPreview?.previewId) return;
    setError("");
    setMessage("");
    try {
      setUploading(true);
      const response = await api.confirmUploadLab({
        previewId: uploadPreview.previewId,
        doctorId: selectedDoctorId,
        patient: uploadPreview.patient || {},
        values: uploadPreview.values || [],
        ...(Number.isInteger(linkedPatientId) ? { patientId: linkedPatientId, clinicId: linkedClinicId } : {})
      });
      setAnalysisResult(response);
      setUploadPreview(null);
      setEditingPatient(false);
      setSelectedFile(null);
      setFileName("");
      setMessage(response.message || "Análise confirmada.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function submitBatch(event) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!localStorage.getItem("bioo3_clinic_scope")) { setError("Selecione uma clínica no topo da página antes de criar o lote."); return; }
    if (!selectedDoctorId) { setError("Selecione o prescritor responsável pelo lote."); return; }
    if (!batchFiles.length) { setError("Selecione pelo menos um PDF."); return; }
    setBatchLoading(true);
    try {
      const data = await api.createLabBatch(batchFiles, selectedDoctorId);
      setBatchFiles([]);
      setActiveBatchId(data.batch.id);
      await refreshBatches();
      setMessage("Lote recebido e enviado para processamento.");
    } catch (err) { setError(err.message); }
    finally { setBatchLoading(false); }
  }

  async function saveBatchAnalysis() {
    if (!batchAnalysis) return;
    setBatchLoading(true); setError("");
    try {
      const payload = {
        patient: {
          name: batchAnalysis.patientName,
          age: batchAnalysis.patientAge,
          cpf: batchAnalysis.patientCpf,
          gender: batchAnalysis.patientGender
        },
        values: (batchAnalysis.results || []).map((result) => ({ testName: result.testName, value: result.value }))
      };
      if (batchAnalysis.prescriptionEdited) payload.prescriptionText = batchAnalysis.prescriptionText || "";
      const data = await api.updateLabBatchAnalysis(batchAnalysis.batchId, batchAnalysis.id, payload);
      setBatches((current) => current.map((batch) => batch.id !== batchAnalysis.batchId ? batch : {
        ...batch,
        analyses: (batch.analyses || []).map((analysis) => analysis.id === data.analysis.id
          ? { ...analysis, ...data.analysis }
          : analysis)
      }));
      setBatchAnalysis(null);
      setMessage("Dados da análise atualizados.");
    } catch (err) { setError(err.message); }
    finally { setBatchLoading(false); }
  }

  async function excludeBatchAnalysis(analysis) {
    if (!window.confirm(`Excluir ${analysis.patientName || "este paciente"} do lote?`)) return;
    try {
      const data = await api.updateLabBatchAnalysis(analysis.batchId, analysis.id, { excluded: true });
      setBatches((current) => current.map((batch) => batch.id !== analysis.batchId ? batch : {
        ...batch,
        analyses: (batch.analyses || []).map((item) => item.id === data.analysis.id
          ? { ...item, ...data.analysis }
          : item)
      }));
    }
    catch (err) { setError(err.message); }
  }

  async function confirmBatch(batch) {
    if (!window.confirm("Confirmar o lote e cadastrar todos os pacientes revisados?")) return;
    setBatchLoading(true); setError("");
    try {
      const data = await api.confirmLabBatch(batch.id);
      setBatches((current) => current.map((item) => item.id === data.batch.id ? data.batch : item));
      setMessage("Lote confirmado. Os relatórios estão sendo gerados.");
    }
    catch (err) { setError(err.message); }
    finally { setBatchLoading(false); }
  }

  async function sendBatch(batch) {
    setBatchLoading(true); setError("");
    try { const data = await api.sendLabBatch(batch.id); await refreshBatches(); setMessage(`${data.queued} relatório(s) colocado(s) na fila do WhatsApp.`); }
    catch (err) { setError(err.message); }
    finally { setBatchLoading(false); }
  }

  async function sendBatchAnalysis(analysis) {
    setBatchLoading(true); setError("");
    try { await api.sendLabAnalysis(analysis.id); await refreshBatches(); setMessage("Relatório colocado na fila do WhatsApp."); }
    catch (err) { setError(err.message); }
    finally { setBatchLoading(false); }
  }

  function updatePreviewValue(testName, value) {
    setUploadPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        values: (current.values || []).map((item) => (
          item.testName === testName ? { ...item, value } : item
        ))
      };
    });
  }

  function removePreviewValue(testName) {
    setUploadPreview((current) => {
      if (!current) return current;
      const values = (current.values || []).filter((item) => item.testName !== testName);
      return {
        ...current,
        values,
        stats: { ...(current.stats || {}), extractedCount: values.length }
      };
    });
  }

  function updatePreviewPatient(field, value) {
    setUploadPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        patient: {
          ...(current.patient || {}),
          [field]: value
        }
      };
    });
  }

  function printAnalysisPdf() {
    if (!analysisResult) return;

    const patient = analysisResult.patient || {};
    const doctor = analysisResult.doctor || {};
    const abnormalResults = (analysisResult.comparison?.results || [])
      .filter((result) => ["high", "low"].includes(result.status));
    const diagnosisRows = abnormalResults.map((result) => `
      <tr>
        <td>${escapeHtml(result.testName)}</td>
        <td>${escapeHtml(result.value)}</td>
        <td>${result.status === "high" ? "Acima" : "Abaixo"}</td>
        <td>${escapeHtml(result.ideal || "")}</td>
      </tr>
    `).join("");
    const prescription = escapeHtml(analysisResult.prescriptionText || "Nenhuma prescrição gerada.").replaceAll("\n", "<br>");
    const today = new Intl.DateTimeFormat("pt-BR").format(new Date());
    const printWindow = window.open("", "_blank", "width=900,height=1100");

    if (!printWindow) {
      setError("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Prescrição BioO3</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #122533; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; }
            header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #bae6fd; padding-bottom: 16px; margin-bottom: 18px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand img { width: 58px; height: 58px; object-fit: contain; }
            .brand strong { display: block; color: #075985; font-size: 22px; }
            .brand span, .date { color: #647888; font-size: 12px; }
            h1 { margin: 0 0 14px; color: #075985; font-size: 18px; }
            h2 { margin: 22px 0 10px; color: #075985; font-size: 15px; }
            .patient-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
            .patient-grid div { border: 1px solid #d8edf7; border-radius: 8px; padding: 9px; background: #f0f9ff; }
            .patient-grid span { display: block; color: #647888; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .patient-grid strong { display: block; margin-top: 3px; color: #122533; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
            th { background: #e0f2fe; color: #075985; font-size: 10px; text-align: left; text-transform: uppercase; }
            th, td { border: 1px solid #d8edf7; padding: 8px; vertical-align: top; }
            .prescription { border: 1px solid #d8edf7; border-radius: 8px; padding: 12px; white-space: normal; }
            .signature { margin-top: 28px; display: grid; justify-content: center; break-inside: avoid; page-break-inside: avoid; }
            .signature-line { width: 300px; border-top: 1px solid #122533; padding-top: 8px; text-align: center; color: #122533; }
            .signature-line strong { display: block; font-size: 12px; text-transform: uppercase; }
            .signature-line span { display: block; margin-top: 3px; color: #647888; font-size: 11px; }
            footer { position: fixed; bottom: 0; left: 0; right: 0; color: #647888; font-size: 10px; text-align: center; }
            @media print {
              h2 { margin-top: 16px; }
              table { margin-bottom: 12px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <header>
            <div class="brand">
              <img src="/assets/logo.svg" alt="BioO3">
              <div>
                <strong>BioO3</strong>
                <span>Relatório de diagnóstico e prescrição</span>
              </div>
            </div>
            <div class="date">Data: ${escapeHtml(today)}</div>
          </header>

          <h1>Informações do paciente</h1>
          <section class="patient-grid">
            <div><span>Paciente</span><strong>${escapeHtml(patient.name || "Não informado")}</strong></div>
            <div><span>Idade</span><strong>${escapeHtml(patient.age || "Não informada")}</strong></div>
            <div><span>Sexo</span><strong>${escapeHtml(patient.gender || "Não informado")}</strong></div>
            <div><span>CPF</span><strong>${escapeHtml(patient.cpf || "Não informado")}</strong></div>
          </section>

          <h2>Diagnóstico - valores alterados</h2>
          <table>
            <thead>
              <tr><th>Exame</th><th>Valor</th><th>Status</th><th>Referência</th></tr>
            </thead>
            <tbody>
              ${diagnosisRows || '<tr><td colspan="4">Nenhum valor alterado encontrado.</td></tr>'}
            </tbody>
          </table>

          <h2>Prescrição</h2>
          <section class="prescription">${prescription}</section>

          <section class="signature">
            <div class="signature-line">
              <strong>${escapeHtml(doctor.name || "Prescritor não informado")}</strong>
              <span>${escapeHtml([doctor.councilType, doctor.councilNumber].filter(Boolean).join(" ") || "Conselho não informado")}</span>
            </div>
          </section>

          <footer>BioO3</footer>
          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function resetUploadFlow() {
    setSelectedFile(null);
    setFileName("");
    setUploadPreview(null);
    setAnalysisResult(null);
    setEditingPatient(false);
    setSelectedDoctorId("");
    setError("");
    setMessage("");
  }

  return (
    <div className="app-frame">
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">BioO3 Lab</p>
            <h1>{linkedPatient ? `Análise de ${linkedPatient.name}` : "Análise de exames"}</h1>
            <p className="page-subtitle">{linkedPatient ? "Análise vinculada ao prontuário deste paciente." : "Análise de exames por entrada manual ou PDF."}</p>
          </div>
        </section>

        <section className="panel">
          <div className="lab-toolbar">
            <div className="segmented-control">
              <button className={mode === "upload" ? "active" : ""} type="button" onClick={() => setMode("upload")}>
                Upload PDF
              </button>
              <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => setMode("manual")}>
                Inserir manualmente
              </button>
              {!linkedPatient && <button className={mode === "batch" ? "active" : ""} type="button" onClick={() => setMode("batch")}>
                Análise múltipla
              </button>}
            </div>
            <div className="doctor-actions">
              <button className="secondary-button" type="button" onClick={() => openDoctorForm()}>
                Cadastrar prescritor
              </button>
              <button className="secondary-button" type="button" onClick={() => setDoctorModal("list")}>
                Ver prescritores
              </button>
              <button className="secondary-button" type="button" onClick={openReferences}>Valores de referência</button>
            </div>
          </div>

          {mode === "upload" ? (
            <form className="lab-upload" onSubmit={submitUpload}>
              <label className="drop-zone">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedFile(file);
                    setFileName(file?.name || "");
                    setUploadPreview(null);
                    setAnalysisResult(null);
                  }}
                />
                <span>{fileName || "Selecione ou arraste um PDF aqui"}</span>
              </label>
              <div className="doctor-actions">
                <button className="primary-button fit-button" type="submit" disabled={uploading}>
                  {uploading ? "Extraindo..." : "Extrair dados"}
                </button>
                {(uploadPreview || analysisResult || selectedFile) && (
                  <button className="secondary-button" type="button" onClick={resetUploadFlow}>Limpar</button>
                )}
              </div>
            </form>
          ) : mode === "manual" ? (
            <form className="form-grid" onSubmit={submitManual}>
              <label><span>Nome do paciente</span><input readOnly={Boolean(linkedPatient)} value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} required /></label>
              <label><span>Idade</span><input readOnly={Boolean(linkedPatient)} type="number" value={manual.age} onChange={(e) => setManual({ ...manual, age: e.target.value })} required /></label>
              <label><span>CPF</span><input readOnly={Boolean(linkedPatient)} value={manual.cpf} onChange={(e) => setManual({ ...manual, cpf: e.target.value })} /></label>
              <label><span>Sexo</span><input readOnly={Boolean(linkedPatient)} value={manual.gender} onChange={(e) => setManual({ ...manual, gender: e.target.value })} /></label>
              <label><span>Telefone</span><input readOnly={Boolean(linkedPatient)} inputMode="numeric" maxLength="11" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: digitsOnly(e.target.value, 11) })} /></label>
              <label><span>Médico</span><input value={manual.doctor} onChange={(e) => setManual({ ...manual, doctor: e.target.value })} /></label>
              <label className="full-width">
                <span>Resultados laboratoriais</span>
                <textarea value={manual.labResults} onChange={(e) => setManual({ ...manual, labResults: e.target.value })} rows="8" required />
              </label>
              <button className="primary-button fit-button" type="submit">Analisar manualmente</button>
            </form>
          ) : (
            <form className="lab-upload batch-upload" onSubmit={submitBatch}>
              <div className="batch-upload-heading"><div><h2>Análise múltipla</h2><p>Selecione até 50 PDFs ou um PDF consolidado. O lote usará a clínica escolhida no topo da página.</p></div><span className="status-pill active">B12 + D3</span></div>
              <label className="review-doctor-select"><span>Prescritor responsável pelo lote</span><select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)} required><option value="">Selecione um prescritor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id} disabled={!doctor.councilType || !doctor.councilNumber}>{doctor.name} · {doctor.councilType && doctor.councilNumber ? `${doctor.councilType} ${doctor.councilNumber}` : "CR não cadastrado"}</option>)}</select></label>
              <label className="drop-zone"><input type="file" accept="application/pdf" multiple onChange={(event) => setBatchFiles([...event.target.files].slice(0, 50))} /><span>{batchFiles.length ? `${batchFiles.length} PDF(s) selecionado(s)` : "Selecione ou arraste os PDFs do lote"}</span></label>
              <button className="primary-button fit-button" type="submit" disabled={batchLoading}>{batchLoading ? "Enviando..." : "Analisar lote"}</button>
            </form>
          )}
        </section>

        {(message || (error && !uploadPreview)) && (
          <section className={`panel lab-feedback-panel ${error ? "has-error" : "has-success"}`}>
            <p className={error ? "form-error lab-message" : "form-success lab-message"}>{error || message}</p>
          </section>
        )}

        {uploadPreview && (
          <section className="panel review-panel">
            <div className="panel-header">
              <div>
                <h2>Revisar dados extraídos</h2>
                <p>Confirme se os dados do paciente e os valores lidos do PDF estão corretos antes de gerar o resultado.</p>
              </div>
              <div className="doctor-actions">
                <button className="secondary-button" type="button" onClick={() => setEditingPatient((value) => !value)} disabled={Boolean(linkedPatient)}>
                  {editingPatient ? "Concluir edição" : "Editar dados"}
                </button>
                <button className="primary-button action-size-button" type="button" onClick={confirmUploadAnalysis} disabled={uploading}>
                  {uploading ? "Confirmando..." : "Aceitar análise"}
                </button>
              </div>
            </div>

            {error && <p className="form-error lab-inline-error">{error}</p>}

            <div className="detail-grid review-detail-grid">
              <div>
                <span>Paciente</span>
                  {editingPatient ? (
                    <input readOnly={Boolean(linkedPatient)} value={uploadPreview.patient?.name || ""} onChange={(event) => updatePreviewPatient("name", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.name || "Não detectado"}</strong>
                )}
              </div>
              <div>
                <span>Idade</span>
                {editingPatient ? (
                  <input readOnly={Boolean(linkedPatient)} type="number" min="0" value={uploadPreview.patient?.age || ""} onChange={(event) => updatePreviewPatient("age", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.age || "Não detectada"}</strong>
                )}
              </div>
              <div>
                <span>Sexo</span>
                {editingPatient ? (
                  <input readOnly={Boolean(linkedPatient)} value={uploadPreview.patient?.gender || ""} onChange={(event) => updatePreviewPatient("gender", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.gender || "Não detectado"}</strong>
                )}
              </div>
              <div>
                <span>CPF</span>
                {editingPatient ? (
                  <input readOnly={Boolean(linkedPatient)} value={uploadPreview.patient?.cpf || ""} onChange={(event) => updatePreviewPatient("cpf", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.cpf || "Não detectado"}</strong>
                )}
              </div>
              <div>
                <span>Telefone</span>
                {editingPatient ? <input readOnly={Boolean(linkedPatient)} inputMode="numeric" maxLength="11" value={uploadPreview.patient?.phone || ""} onChange={(event) => updatePreviewPatient("phone", digitsOnly(event.target.value, 11))} /> : <strong>{uploadPreview.patient?.phone || "Não detectado"}</strong>}
              </div>
            </div>

            <div className="lab-stats">
              <span>{uploadPreview.stats?.extractedCount || 0} valores extraídos</span>
              <span>{uploadPreview.stats?.lineCount || 0} linhas lidas</span>
            </div>

            <label className="review-doctor-select">
              <span>Prescritor responsável</span>
              <select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)} required>
                <option value="">Selecione um prescritor</option>
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id} disabled={!doctor.councilType || !doctor.councilNumber}>{doctor.name} · {doctor.councilType && doctor.councilNumber ? `${doctor.councilType} ${doctor.councilNumber}` : "CR não cadastrado"}</option>)}
              </select>
            </label>

            <div className="table-wrap">
              <table className="control-table lab-values-table">
                <thead>
                  <tr>
                    <th>Exame</th>
                    <th>Valor</th>
                    <th aria-label="Ações"></th>
                  </tr>
                </thead>
                <tbody>
                  {(uploadPreview.values || []).map((item) => (
                    <tr key={`${item.testName}-${item.lineNumber}`}>
                      <td className="strong-cell">{item.testName}</td>
                      <td>
                        {editingPatient ? (
                          <input
                            className="value-input"
                            type="number"
                            step="any"
                            value={item.value}
                            onChange={(event) => updatePreviewValue(item.testName, event.target.value)}
                          />
                        ) : (
                          <span className="readonly-value">{item.value}</span>
                        )}
                      </td>
                      <td className="lab-value-actions">
                        <ActionButton action="delete" iconOnly onClick={() => removePreviewValue(item.testName)} aria-label={`Remover exame ${item.testName}`} />
                      </td>
                    </tr>
                  ))}
                  {!uploadPreview.values?.length && (
                    <tr><td colSpan="3" className="center">Nenhum valor encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {analysisResult && (
          <section className="panel result-panel">
            <div className="panel-header">
              <div>
                <h2>Resultado da análise</h2>
                <p>Comparação gerada a partir dos valores aceitos e das referências cadastradas.</p>
              </div>
              <button className="primary-button" type="button" onClick={printAnalysisPdf}>Gerar PDF</button>
            </div>

            <div className="metric-grid lab-result-grid">
              <article className="summary-card"><p>Normais</p><strong>{analysisResult.comparison?.summary?.normal || 0}</strong></article>
              <article className="summary-card"><p>Abaixo</p><strong>{analysisResult.comparison?.summary?.low || 0}</strong></article>
              <article className="summary-card"><p>Acima</p><strong>{analysisResult.comparison?.summary?.high || 0}</strong></article>
            </div>

            <div className="analysis-text-grid">
              <article>
                <h3>Diagnóstico</h3>
                <pre>{analysisResult.diagnosisText || "Nenhum diagnóstico gerado."}</pre>
              </article>
              <article>
                <h3>Prescrição</h3>
                <textarea rows="12" value={analysisResult.prescriptionText || ""} onChange={(event) => setAnalysisResult({ ...analysisResult, prescriptionText: event.target.value })} />
                {analysisResult.patientId && <button className="secondary-button" type="button" onClick={async () => { try { await api.updateAnalysisPrescription(analysisResult.patientId, analysisResult.prescriptionText || ""); setMessage("Prescrição salva."); } catch (err) { setError(err.message); } }}>Salvar prescrição</button>}
              </article>
            </div>
          </section>
        )}

        {mode === "batch" && (() => {
          const batch = batches.find((item) => item.id === activeBatchId) || batches[0];
          return <section className="panel batch-results-panel">
            <div className="panel-header"><div><h2>Lotes analisados</h2><p>Revise os pacientes antes de confirmar e acompanhe cada envio ao WhatsApp.</p></div>{batches.length > 0 && <select value={batch?.id || ""} onChange={(event) => setActiveBatchId(event.target.value)}>{batches.map((item) => <option key={item.id} value={item.id}>{batchOptionLabel(item)}</option>)}</select>}</div>
            {!batch && <div className="empty-state compact-empty">Nenhum lote criado para a clínica selecionada.</div>}
            {batch && <>
              <div className="batch-summary"><span className={`status-pill ${batch.status === "FAILED" ? "muted" : "active"}`}>{batchStatusLabels[batch.status] || batch.status}</span><strong>{batch.clinic?.name}</strong><span>{batch.candidateCount || 0} paciente(s)</span><span>{batch.doctor?.name}</span></div>
              {batch.error && <p className="form-error">{batch.error}</p>}
              <div className="table-wrap"><table className="control-table batch-analysis-table"><thead><tr><th>Paciente</th><th>Vitamina B12</th><th>25-hidroxi D3</th><th>WhatsApp</th><th>Ações</th></tr></thead><tbody>{(batch.analyses || []).map((analysis) => {
                const b12 = batchResult(analysis, "Vitamina B12"); const d3 = batchResult(analysis, "25-hidroxi D3");
                return <tr key={analysis.id} className={analysis.status === "EXCLUDED" ? "muted-row" : ""}><td><strong>{analysis.patientName || "Não identificado"}</strong><small>{analysis.matchingStatus === "MATCHED" ? "Paciente existente" : analysis.matchingStatus === "CREATED" ? "Paciente criado" : analysis.matchingStatus === "AMBIGUOUS" ? "Correspondência ambígua" : "Novo paciente"}</small>{analysis.error && <small className="form-error">{analysis.error}</small>}</td><td><span className={`result-status ${b12.status.toLowerCase()}`}>{resultStatusLabels[b12.status]}</span><small>{b12.value ?? "—"} {b12.unit}</small></td><td><span className={`result-status ${d3.status.toLowerCase()}`}>{resultStatusLabels[d3.status]}</span><small>{d3.value ?? "—"} {d3.unit}</small></td><td>{deliveryStatusLabels[analysis.whatsappDelivery?.status] || "Não enviado"}{analysis.whatsappDelivery?.lastError && <small className="form-error">{analysis.whatsappDelivery.lastError}</small>}</td><td><div className="row-actions batch-row-actions"><button className="secondary-button compact-button" type="button" onClick={() => setBatchAnalysis({ ...structuredClone(analysis), prescriptionEdited: false })}>Detalhes</button>{batch.status === "REVIEW" && analysis.status !== "EXCLUDED" && <button className="danger-button compact-button" type="button" onClick={() => excludeBatchAnalysis(analysis)}>Excluir</button>}{analysis.hasAlteration && analysis.status === "READY" && !["QUEUED", "SENDING", "SENT", "DELIVERED", "READ"].includes(analysis.whatsappDelivery?.status) && <button className="primary-button compact-button" type="button" onClick={() => sendBatchAnalysis(analysis)}>Enviar pelo WhatsApp</button>}</div></td></tr>;
              })}{!batch.analyses?.length && <tr><td colSpan="5"><div className="empty-state compact-empty">Aguardando processamento dos PDFs.</div></td></tr>}</tbody></table></div>
              <div className="batch-toolbar batch-footer-actions">{batch.status === "REVIEW" && <button className="primary-button" type="button" disabled={batchLoading} onClick={() => confirmBatch(batch)}>{batchLoading ? "Confirmando..." : "Confirmar lote"}</button>}{batch.status === "CONFIRMED" && <button className="primary-button" type="button" disabled={batchLoading || !(batch.analyses || []).some((analysis) => analysis.hasAlteration && analysis.status === "READY")} onClick={() => sendBatch(batch)}>{batchLoading ? "Preparando envio..." : "Enviar todos pelo WhatsApp"}</button>}</div>
            </>}
          </section>;
        })()}
      </main>

      {batchAnalysis && (() => {
        const editable = batches.find((item) => item.id === batchAnalysis.batchId)?.status === "REVIEW";
        const titleId = `batch-analysis-title-${batchAnalysis.id}`;
        const descriptionId = batchAnalysis.error ? `batch-analysis-description-${batchAnalysis.id}` : undefined;
        return createPortal(
          <div
            className="modal-backdrop batch-analysis-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <div className="modal-card batch-analysis-modal">
              <button className="modal-close" type="button" onClick={() => setBatchAnalysis(null)}>×</button>
              <h2 id={titleId}>Detalhes da análise</h2>
              <p className="muted-text">Páginas {batchAnalysis.pageStart}–{batchAnalysis.pageEnd}</p>
              {batchAnalysis.error && <p id={descriptionId} className="form-error">{batchAnalysis.error}</p>}
              <div className="form-grid">
                <label className="full-width">
                  <span>Paciente</span>
                  <input value={batchAnalysis.patientName} disabled={!editable} onChange={(event) => setBatchAnalysis({ ...batchAnalysis, patientName: event.target.value })} />
                </label>
                <label>
                  <span>Idade</span>
                  <input type="number" value={batchAnalysis.patientAge || ""} disabled={!editable} onChange={(event) => setBatchAnalysis({ ...batchAnalysis, patientAge: event.target.value })} />
                </label>
                <label>
                  <span>CPF</span>
                  <input value={batchAnalysis.patientCpf || ""} disabled={!editable} onChange={(event) => setBatchAnalysis({ ...batchAnalysis, patientCpf: digitsOnly(event.target.value, 11) })} />
                </label>
                {["Vitamina B12", "25-hidroxi D3"].map((testName) => {
                  const result = batchResult(batchAnalysis, testName);
                  const values = conflictingValues(result);
                  return <label key={testName}>
                    <span>{testName}</span>
                    <input type="number" step="any" value={result.value ?? ""} disabled={!editable} onChange={(event) => setBatchAnalysis({ ...batchAnalysis, results: batchAnalysis.results.map((item) => item.testName === testName ? { ...item, value: event.target.value } : item) })} />
                    {values.length > 1 && result.value === null && <small className="form-error">Valores encontrados: {values.join(", ")}. Informe o valor a considerar.</small>}
                  </label>;
                })}
                <label className="full-width">
                  <span>Prescrição</span>
                  <textarea rows="10" value={batchAnalysis.prescriptionText || ""} disabled={!editable} onChange={(event) => setBatchAnalysis({ ...batchAnalysis, prescriptionText: event.target.value, prescriptionEdited: true })} placeholder="Nenhuma prescrição gerada." />
                </label>
              </div>
              <div className="modal-actions batch-analysis-actions">
                {batchAnalysis.reportUrl && <>
                  <a className="secondary-button" href={apiAssetUrl(batchAnalysis.reportUrl)} target="_blank" rel="noreferrer">Ver prescrição</a>
                  <a className="secondary-button" href={`${apiAssetUrl(batchAnalysis.reportUrl)}?disposition=attachment`}>Baixar prescrição</a>
                </>}
                {editable && <button className="primary-button" type="button" disabled={batchLoading} onClick={saveBatchAnalysis}>{batchLoading ? "Salvando..." : "Salvar alterações"}</button>}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {doctorModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card doctor-modal">
            <button className="modal-close" type="button" onClick={() => setDoctorModal(null)}>×</button>
            {doctorModal === "create" || doctorModal === "edit" ? (
              <>
                <div className="doctor-modal-heading"><div><p className="eyebrow">Prescritores</p><h2>{doctorModal === "edit" ? "Editar prescritor" : "Novo prescritor"}</h2><p>Todos os campos são obrigatórios.</p></div></div>
                <form className="form-grid doctor-form" onSubmit={saveDoctor}>
                  <label><span>Nome completo</span><input value={doctorDraft.name} onChange={(e) => setDoctorDraft({ ...doctorDraft, name: uppercase(e.target.value) })} minLength="2" autoFocus required /></label>
                  <label><span>Telefone</span><input inputMode="numeric" pattern="[0-9]{10,11}" minLength="10" maxLength="11" value={doctorDraft.phone} onChange={(e) => setDoctorDraft({ ...doctorDraft, phone: digitsOnly(e.target.value, 11) })} required /></label>
                  <label><span>Tipo do conselho</span><input placeholder="CRM" value={doctorDraft.councilType} onChange={(e) => setDoctorDraft({ ...doctorDraft, councilType: uppercase(e.target.value).replace(/[^A-Z-]/g, "").slice(0, 12) })} minLength="2" maxLength="12" required /></label>
                  <label><span>Número do conselho</span><input inputMode="numeric" pattern="[0-9]{3,12}" minLength="3" maxLength="12" value={doctorDraft.councilNumber} onChange={(e) => setDoctorDraft({ ...doctorDraft, councilNumber: digitsOnly(e.target.value, 12) })} required /></label>
                  {doctorError && <p className="form-error full-width">{doctorError}</p>}
                  <div className="modal-actions full-width"><button className="secondary-button" type="button" onClick={() => setDoctorModal("list")}>Cancelar</button><button className="primary-button" type="submit" disabled={doctorSubmitting}>{doctorSubmitting ? "Salvando..." : doctorModal === "edit" ? "Salvar alterações" : "Cadastrar prescritor"}</button></div>
                </form>
              </>
            ) : (
              <>
                <div className="doctor-list-heading"><div><p className="eyebrow">Prescritores</p><h2>Prescritores cadastrados</h2></div></div>
                {doctorError && <p className="form-error">{doctorError}</p>}
                {doctorLoading ? <TableSkeleton columns={4} rows={5} /> : <div className="table-wrap">
                  <table className="control-table doctor-table">
                    <thead><tr><th>Nome</th><th>Telefone</th><th>Conselho</th><th aria-label="Ações"></th></tr></thead>
                    <tbody>
                      {doctors.map((doctor) => (
                        <tr key={doctor.id}><td><strong>{doctor.name}</strong>{doctor.clinic?.name && <small>{doctor.clinic.name}</small>}</td><td>{doctor.phone || "—"}</td><td><span className="council-value"><b>{doctor.councilType || "—"}</b><span>{doctor.councilNumber || "Não cadastrado"}</span></span></td><td><div className="icon-actions"><ActionButton action="edit" iconOnly onClick={() => openDoctorForm(doctor)} aria-label={`Editar ${doctor.name}`} /><ActionButton action="delete" iconOnly onClick={() => deleteDoctor(doctor)} aria-label={`Excluir ${doctor.name}`} /></div></td></tr>
                      ))}
                      {!doctors.length && <tr><td colSpan="4" className="center">Nenhum prescritor cadastrado.</td></tr>}
                    </tbody>
                  </table>
                </div>}
              </>
            )}
          </div>
        </div>
      )}
      {referenceModal && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card reference-modal"><button className="modal-close" type="button" onClick={() => setReferenceModal(false)}>×</button><h2>Valores de referência</h2><p className="muted-text">Lista geral usada nas análises. {user?.role === "ADMIN" ? "Você pode editar os intervalos." : "Somente o administrador pode editar."}</p><div className="reference-toolbar"><input type="search" placeholder="Pesquisar exame..." value={referenceSearch} onChange={(e) => setReferenceSearch(e.target.value)} /><strong>{references.length} referências</strong></div>{referenceError && <p className="form-error">{referenceError}</p>}{referenceLoading && <TableSkeleton columns={3} rows={6} />}{!referenceLoading && !referenceError && <div className="reference-list"><div className="reference-list-header"><span>Exame</span><span>Intervalo de referência</span><span></span></div>{references.filter((item) => item.testName.toLowerCase().includes(referenceSearch.toLowerCase())).map((reference) => <div className="reference-row" key={reference.testName}><strong>{reference.testName}</strong><input value={reference.ideal} disabled={user?.role !== "ADMIN"} onChange={(e) => setReferences((items) => items.map((item) => item.testName === reference.testName ? { ...item, ideal: e.target.value } : item))} />{user?.role === "ADMIN" ? <button className="secondary-button compact-button" type="button" onClick={() => saveReference(reference)}>Salvar</button> : <span />}</div>)}{!references.length && <div className="empty-state compact-empty">Nenhuma referência encontrada.</div>}</div>}</div></div>}
    </div>
  );
}
