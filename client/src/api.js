const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
let clinicScope = localStorage.getItem("bioo3_clinic_scope") || "";

function scopedPath(path) {
  const operational = ["/dashboard", "/patients", "/products", "/agenda", "/lab"];
  if (!clinicScope || !operational.some((prefix) => path.startsWith(prefix))) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}clinicId=${encodeURIComponent(clinicScope)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${scopedPath(path)}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

export const api = {
  setClinicScope: (clinicId) => {
    clinicScope = clinicId ? String(clinicId) : "";
    if (clinicScope) localStorage.setItem("bioo3_clinic_scope", clinicScope);
    else localStorage.removeItem("bioo3_clinic_scope");
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
  approveClinic: (id) => request(`/admin/clinics/${id}/approve`, { method: "PATCH" }),
  rejectClinic: (id, reason) => request(`/admin/clinics/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  setClinicStatus: (id, status) => request(`/admin/clinics/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  setClinicEmail: (id, email) => request(`/admin/clinics/${id}/email`, { method: "PATCH", body: JSON.stringify({ email }) })
};
