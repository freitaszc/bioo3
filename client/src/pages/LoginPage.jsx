import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState({ clinicName: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/inicio" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegistration(event) {
    event.preventDefault(); setError(""); setMessage(""); setSubmitting(true);
    try {
      const data = await api.register(registration);
      setMessage(data.message); setRegistration({ clinicName: "", email: "", password: "" });
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Login BioO3">
        <aside className="login-hero">
          <div className="login-hero-mark">
            <img src="/assets/logo.svg" alt="BioO3" />
          </div>
          <div>
            <p className="login-kicker">BioO3</p>
            <h1>Gestão clínica em uma área de trabalho simples.</h1>
            <p>
              Acesse análises, pacientes e operações com uma interface leve,
              organizada e pronta para evoluir por módulos.
            </p>
          </div>
        </aside>

        <section className="login-form-panel">
          <div className="login-form-heading">
            <div>
              <h2>{registering ? "Solicitar acesso" : "Entrar"}</h2>
              <p>{registering ? "Cadastre sua clínica para aprovação." : "Use suas credenciais para acessar o painel."}</p>
            </div>
          </div>
          <form onSubmit={registering ? handleRegistration : handleSubmit}>
            {registering && <label><span>Nome da clínica</span><input value={registration.clinicName} onChange={(e) => setRegistration({ ...registration, clinicName: e.target.value })} required /></label>}
            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={registering ? registration.email : form.email}
                autoComplete="username"
                onChange={(event) => registering ? setRegistration({ ...registration, email: event.target.value }) : setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Senha</span>
              <input
                type="password"
                value={registering ? registration.password : form.password}
                autoComplete="current-password"
                onChange={(event) => registering ? setRegistration({ ...registration, password: event.target.value }) : setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {message && <p className="form-success">{message}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : registering ? "Enviar para aprovação" : "Entrar"}
            </button>
            <button className="secondary-button" type="button" onClick={() => { setRegistering(!registering); setError(""); setMessage(""); }}>
              {registering ? "Já tenho uma conta" : "Cadastrar clínica"}
            </button>
          </form>
        </section>
      </section>

      <footer className="login-footer">
        <p>Contato: contato@bioo3.com.br | Telefone: (31) 99557-3925</p>
        <p>Endereço: Rua Siquem, 207 - Canaã, Ipatinga - MG</p>
      </footer>
    </main>
  );
}
