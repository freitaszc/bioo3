import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { RouteSkeleton } from "./components/Skeleton";
import AccountPage from "./pages/AccountPage";
import AgendaPage from "./pages/AgendaPage";
import BioO3LabPage from "./pages/BioO3LabPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PatientsPage from "./pages/PatientsPage";
import StaticPage from "./pages/StaticPage";
import StockPage from "./pages/StockPage";
import VideoPage from "./pages/VideoPage";
import VideosPage from "./pages/VideosPage";
import ClinicsPage from "./pages/ClinicsPage";
import PlanTemplatesPage from "./pages/PlanTemplatesPage";
import ProntuarioPage from "./pages/ProntuarioPage";

function ProtectedRoute({ children }) {
  const { loading, user } = useAuth();

  if (loading) {
    return <RouteSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacy-policy" element={<StaticPage type="privacy" />} />
      <Route path="/about" element={<StaticPage type="about" />} />
      <Route path="/inicio" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/videoaulas" element={<ProtectedRoute><VideosPage /></ProtectedRoute>} />
      <Route path="/videoaulas/:id" element={<ProtectedRoute><VideoPage /></ProtectedRoute>} />
      <Route path="/bioo3-lab" element={<ProtectedRoute><BioO3LabPage /></ProtectedRoute>} />
      <Route path="/pacientes" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
      <Route path="/pacientes/:id" element={<ProtectedRoute><ProntuarioPage /></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/admin/clinics" element={<ProtectedRoute><ClinicsPage /></ProtectedRoute>} />
      <Route path="/admin/plan-templates" element={<ProtectedRoute><PlanTemplatesPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}
