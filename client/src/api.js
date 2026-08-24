const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
let clinicScope = localStorage.getItem("bioo3_clinic_scope") || "";

function scopedPath(path) {
  const operational = ["/dashboard", "/patients", "/products", "/agenda", "/lab", "/inventory", "/cash", "/patient-plans"];
  if (!clinicScope || !operational.some((prefix) => path.startsWith(prefix))) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}clinicId=${encodeURIComponent(clinicScope)}`;
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${scopedPath(path)}`, {
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Falha na requisição.");
  }
  return data;
}

export function apiAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path || "";
  if (path.startsWith("/api/")) return `${API_BASE_URL.replace(/\/api\/?$/, "")}${path}`;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const api = {
  setClinicScope: (clinicId) => {
    clinicScope = clinicId ? String(clinicId) : "";
    if (clinicScope) localStorage.setItem("bioo3_clinic_scope", clinicScope);
    else localStorage.removeItem("bioo3_clinic_scope");
    window.dispatchEvent(new CustomEvent("bioo3:clinic-scope-change", { detail: { clinicId: clinicScope } }));
  },
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  dashboardCounts: (days = 7) => request(`/dashboard/analysis-counts?days=${days}`),
  videos: () => request("/videos"),
  video: (id) => request(`/videos/${id}`),
  patients: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/patients${suffix}`);
  },
  patient: (id) => request(`/patients/${id}`),
  createPatient: (payload) => request("/patients", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updatePatient: (id, payload) => request(`/patients/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  updatePatientStatus: (id, status) => request(`/patients/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }),
  deletePatient: (id) => request(`/patients/${id}`, { method: "DELETE" }),
  deletePatients: (ids) => request("/patients/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids })
  }),
  createConsultation: (id, payload) => request(`/patients/${id}/consultations`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  patientPlans: (patientId) => request(`/patient-plans${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ""}`),
  createPatientPlan: (payload) => request("/patient-plans", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updatePatientPlan: (id, payload) => request(`/patient-plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  updatePatientPlanStatus: (id, status) => request(`/patient-plans/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }),
  updatePlanSession: (planId, sessionNumber, status) => request(`/patient-plans/${planId}/sessions/${sessionNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }),
  products: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.stock) query.set("stock", params.stock);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/products${suffix}`);
  },
  createProduct: (payload) => request("/products", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updateProduct: (id, payload) => request(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  updateProductStatus: (id, status) => request(`/products/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  deleteProducts: (ids) => request("/products/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids })
  }),
  suppliers: () => request("/inventory/suppliers"),
  createSupplier: (payload) => request("/inventory/suppliers", { method: "POST", body: JSON.stringify(payload) }),
  updateSupplier: (id, payload) => request(`/inventory/suppliers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSupplier: (id) => request(`/inventory/suppliers/${id}`, { method: "DELETE" }),
  stockLots: (params = {}) => {
    const query = params.productId ? `?productId=${encodeURIComponent(params.productId)}` : "";
    return request(`/inventory/lots${query}`);
  },
  createStockLot: (payload) => request("/inventory/lots", { method: "POST", body: JSON.stringify(payload) }),
  stockMovements: (params = {}) => {
    const query = new URLSearchParams();
    if (params.productId) query.set("productId", params.productId);
    if (params.type) query.set("type", params.type);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/inventory/movements${suffix}`);
  },
  createStockMovement: (payload) => request("/inventory/movements", { method: "POST", body: JSON.stringify(payload) }),
  sales: (status = "") => request(`/cash/sales${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  sale: (id) => request(`/cash/sales/${id}`),
  createSale: (payload) => request("/cash/sales", { method: "POST", body: JSON.stringify(payload) }),
  createPayment: (saleId, payload) => request(`/cash/sales/${saleId}/payments`, { method: "POST", body: JSON.stringify(payload) }),
  createReceipt: (saleId) => request(`/cash/sales/${saleId}/receipt`, { method: "POST" }),
  requestFiscalDocument: (saleId) => request(`/cash/sales/${saleId}/fiscal-document`, { method: "POST" }),
  agendaEvents: (month) => request(`/agenda${month ? `?month=${month}` : ""}`),
  createAgendaEvent: (payload) => request("/agenda", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updateAgendaEvent: (id, payload) => request(`/agenda/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  deleteAgendaEvent: (id) => request(`/agenda/${id}`, { method: "DELETE" }),
  doctors: () => request("/lab/doctors"),
  createDoctor: (payload) => request("/lab/doctors", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updateDoctor: (id, payload) => request(`/lab/doctors/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteDoctor: (id) => request(`/lab/doctors/${id}`, { method: "DELETE" }),
  references: () => request("/lab/references"),
  updateReference: (testName, ideal) => request(`/lab/references/${encodeURIComponent(testName)}`, { method: "PUT", body: JSON.stringify({ ideal }) }),
  updateAnalysisPrescription: (patientId, prescription) => request(`/lab/patients/${patientId}/prescription`, { method: "PATCH", body: JSON.stringify({ prescription }) }),
  submitManualLab: (payload) => request("/lab/manual", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  previewUploadLab: (payload) => request("/lab/upload/preview", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  confirmUploadLab: (payload) => request("/lab/upload/confirm", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  labBatches: () => request("/lab/batches"),
  labBatch: (id) => request(`/lab/batches/${id}`),
  createLabBatch: (files, doctorId) => {
    const body = new FormData();
    body.set("doctorId", doctorId);
    for (const file of files) body.append("files", file);
    return request("/lab/batches", { method: "POST", body });
  },
  updateLabBatchAnalysis: (batchId, analysisId, payload) => request(`/lab/batches/${batchId}/analyses/${analysisId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }),
  confirmLabBatch: (id) => request(`/lab/batches/${id}/confirm`, { method: "POST" }),
  sendLabBatch: (id) => request(`/lab/batches/${id}/send`, { method: "POST" }),
  sendLabAnalysis: (id) => request(`/lab/analyses/${id}/send`, { method: "POST" }),
  submitUploadLab: () => request("/lab/upload", { method: "POST" }),
  updateProfile: (payload) => request("/account/profile", {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  updatePassword: (payload) => request("/account/password", {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  clinics: (status = "") => request(`/admin/clinics${status ? `?status=${status}` : ""}`),
  createClinic: (payload) => request("/admin/clinics", { method: "POST", body: JSON.stringify(payload) }),
  updateClinic: (id, payload) => request(`/admin/clinics/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  setClinicStatus: (id, status) => request(`/admin/clinics/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteClinic: (id) => request(`/admin/clinics/${id}`, { method: "DELETE" }),
  whatsappConnection: () => request("/admin/whatsapp"),
  connectWhatsapp: (payload) => request("/admin/whatsapp/connect", { method: "POST", body: JSON.stringify(payload) }),
  testWhatsapp: () => request("/admin/whatsapp/test", { method: "POST" }),
  disconnectWhatsapp: () => request("/admin/whatsapp", { method: "DELETE" }),
  planTemplates: () => request("/plan-templates"),
  planCatalog: () => request("/plan-templates/catalog"),
  createPlanTemplate: (payload) => request("/plan-templates", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  updatePlanTemplate: (id, payload) => request(`/plan-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),
  deletePlanTemplate: (id) => request(`/plan-templates/${id}`, { method: "DELETE" })
};
