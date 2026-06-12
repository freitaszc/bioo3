import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
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
              <h2>Entrar</h2>
              <p>Use suas credenciais para acessar o painel.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <label>
              <span>Usuário</span>
              <input
                value={form.username}
                autoComplete="username"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Senha</span>
              <input
                type="password"
                value={form.password}
                autoComplete="current-password"
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
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
