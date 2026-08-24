import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
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
import ProntuarioPage from "./pages/ProntuarioPage";
import CashPage from "./pages/CashPage";
import Topbar from "./components/Topbar";

function ProtectedLayout() {
  const { loading, user } = useAuth();
  const location = useLocation();
  const [scopeRevision, setScopeRevision] = useState(0);

  useEffect(() => {
    const refreshScope = () => setScopeRevision((current) => current + 1);
    window.addEventListener("bioo3:clinic-scope-change", refreshScope);
    return () => window.removeEventListener("bioo3:clinic-scope-change", refreshScope);
  }, []);

  if (loading) {
    return <RouteSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <div className="app-shell"><Topbar /><div className="route-transition" key={`${location.pathname}:${location.search}:${scopeRevision}`}><Outlet /></div></div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacy-policy" element={<StaticPage type="privacy" />} />
      <Route path="/about" element={<StaticPage type="about" />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/inicio" element={<HomePage />} />
        <Route path="/videoaulas" element={<VideosPage />} />
        <Route path="/videoaulas/:id" element={<VideoPage />} />
        <Route path="/bioo3-lab" element={<BioO3LabPage />} />
        <Route path="/pacientes" element={<PatientsPage />} />
        <Route path="/pacientes/:id" element={<ProntuarioPage />} />
        <Route path="/estoque" element={<StockPage />} />
        <Route path="/caixa" element={<CashPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin/clinics" element={<ClinicsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}
