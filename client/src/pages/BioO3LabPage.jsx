import { useEffect, useState } from "react";
import { api } from "../api";
import Topbar from "../components/Topbar";

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

export default function BioO3LabPage() {
  const [mode, setMode] = useState("upload");
  const [manual, setManual] = useState(emptyManual);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorDraft, setDoctorDraft] = useState({ name: "", phone: "" });
  const [doctorModal, setDoctorModal] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshDoctors() {
    const data = await api.doctors();
    setDoctors(data.doctors || []);
  }

  useEffect(() => {
    refreshDoctors().catch(() => setDoctors([]));
  }, []);

  async function saveDoctor(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createDoctor(doctorDraft);
      setDoctorDraft({ name: "", phone: "" });
      await refreshDoctors();
      setDoctorModal("list");
      setMessage("Prescritor cadastrado.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitManual(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await api.submitManualLab(manual);
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
      const response = await api.previewUploadLab({ filename: selectedFile.name, data });
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
        patient: uploadPreview.patient || {},
        values: uploadPreview.values || []
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
            @page { size: A4; margin: 18mm; }
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
            .signature { margin-top: 54px; display: grid; justify-content: center; }
            .signature-line { width: 260px; border-top: 1px solid #122533; padding-top: 8px; text-align: center; color: #647888; }
            footer { position: fixed; bottom: 0; left: 0; right: 0; color: #647888; font-size: 10px; text-align: center; }
            @media print { button { display: none; } }
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
            <div class="signature-line">Assinatura do prescritor</div>
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
    setError("");
    setMessage("");
  }

  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <section className="page-heading">
          <div>
            <p className="eyebrow">BioO3 Lab</p>
            <h1>Análise de exames</h1>
            <p className="page-subtitle">Análise de exames por entrada manual ou PDF.</p>
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
            </div>
            <div className="doctor-actions">
              <button className="secondary-button" type="button" onClick={() => setDoctorModal("create")}>
                Cadastrar prescritor
              </button>
              <button className="secondary-button" type="button" onClick={() => setDoctorModal("list")}>
                Ver prescritores
              </button>
            </div>
          </div>

          {message && <p className="form-success lab-message">{message}</p>}
          {error && <p className="form-error lab-message">{error}</p>}

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
          ) : (
            <form className="form-grid" onSubmit={submitManual}>
              <label><span>Nome do paciente</span><input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} required /></label>
              <label><span>Idade</span><input type="number" value={manual.age} onChange={(e) => setManual({ ...manual, age: e.target.value })} required /></label>
              <label><span>CPF</span><input value={manual.cpf} onChange={(e) => setManual({ ...manual, cpf: e.target.value })} /></label>
              <label><span>Sexo</span><input value={manual.gender} onChange={(e) => setManual({ ...manual, gender: e.target.value })} /></label>
              <label><span>Telefone</span><input value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} /></label>
              <label><span>Médico</span><input value={manual.doctor} onChange={(e) => setManual({ ...manual, doctor: e.target.value })} /></label>
              <label className="full-width">
                <span>Resultados laboratoriais</span>
                <textarea value={manual.labResults} onChange={(e) => setManual({ ...manual, labResults: e.target.value })} rows="8" required />
              </label>
              <button className="primary-button fit-button" type="submit">Analisar manualmente</button>
            </form>
          )}
        </section>

        {uploadPreview && (
          <section className="panel review-panel">
            <div className="panel-header">
              <div>
                <h2>Revisar dados extraídos</h2>
                <p>Confirme se os dados do paciente e os valores lidos do PDF estão corretos antes de gerar o resultado.</p>
              </div>
              <div className="doctor-actions">
                <button className="secondary-button" type="button" onClick={() => setEditingPatient((value) => !value)}>
                  {editingPatient ? "Concluir edição" : "Editar dados"}
                </button>
                <button className="primary-button action-size-button" type="button" onClick={confirmUploadAnalysis} disabled={uploading}>
                  {uploading ? "Confirmando..." : "Aceitar análise"}
                </button>
              </div>
            </div>

            <div className="detail-grid">
              <div>
                <span>Paciente</span>
                {editingPatient ? (
                  <input value={uploadPreview.patient?.name || ""} onChange={(event) => updatePreviewPatient("name", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.name || "Não detectado"}</strong>
                )}
              </div>
              <div>
                <span>Idade</span>
                {editingPatient ? (
                  <input type="number" min="0" value={uploadPreview.patient?.age || ""} onChange={(event) => updatePreviewPatient("age", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.age || "Não detectada"}</strong>
                )}
              </div>
              <div>
                <span>Sexo</span>
                {editingPatient ? (
                  <input value={uploadPreview.patient?.gender || ""} onChange={(event) => updatePreviewPatient("gender", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.gender || "Não detectado"}</strong>
                )}
              </div>
              <div>
                <span>CPF</span>
                {editingPatient ? (
                  <input value={uploadPreview.patient?.cpf || ""} onChange={(event) => updatePreviewPatient("cpf", event.target.value)} />
                ) : (
                  <strong>{uploadPreview.patient?.cpf || "Não detectado"}</strong>
                )}
              </div>
            </div>

            <div className="lab-stats">
              <span>{uploadPreview.stats?.extractedCount || 0} valores extraídos</span>
              <span>{uploadPreview.stats?.lineCount || 0} linhas lidas</span>
            </div>

            <div className="table-wrap">
              <table className="control-table lab-values-table">
                <thead>
                  <tr>
                    <th>Exame</th>
                    <th>Valor</th>
                    <th>Linha de origem</th>
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
                      <td>{item.sourceLine}</td>
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
                <pre>{analysisResult.prescriptionText || "Nenhuma prescrição gerada."}</pre>
              </article>
            </div>
          </section>
        )}
      </main>

      {doctorModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <button className="modal-close" type="button" onClick={() => setDoctorModal(null)}>×</button>
            {doctorModal === "create" ? (
              <>
                <h2>Cadastrar prescritor</h2>
                <form className="form-grid one-column" onSubmit={saveDoctor}>
                  <label><span>Nome</span><input value={doctorDraft.name} onChange={(e) => setDoctorDraft({ ...doctorDraft, name: e.target.value })} required /></label>
                  <label><span>Telefone</span><input value={doctorDraft.phone} onChange={(e) => setDoctorDraft({ ...doctorDraft, phone: e.target.value })} /></label>
                  <button className="primary-button fit-button" type="submit">Salvar</button>
                </form>
              </>
            ) : (
              <>
                <h2>Prescritores</h2>
                <div className="table-wrap">
                  <table className="control-table">
                    <thead><tr><th>Nome</th><th className="center">Telefone</th></tr></thead>
                    <tbody>
                      {doctors.map((doctor) => (
                        <tr key={doctor.id}><td>{doctor.name}</td><td className="center">{doctor.phone || "—"}</td></tr>
                      ))}
                      {!doctors.length && <tr><td colSpan="2" className="center">Nenhum prescritor cadastrado.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
