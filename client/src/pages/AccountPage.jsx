import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function AccountPage() {
  const { setUser, user } = useAuth();
  const [profile, setProfile] = useState({
    firstName: "",
    email: "",
    profileImagePath: "/assets/user-icon.png"
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName || "",
        email: user.email || "",
        profileImagePath: user.profileImagePath || "/assets/user-icon.png"
      });
    }
  }, [user]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    try {
      const data = await api.updateProfile(profile);
      setUser(data.user);
      setProfileMessage("Informações atualizadas.");
    } catch (err) {
      setProfileError(err.message);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    try {
      await api.updatePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      setPasswordMessage("Senha atualizada.");
    } catch (err) {
      setPasswordError(err.message);
    }
  }

  return (
    <div className="app-frame">
      <main className="page-shell account-grid">
        <section className="page-heading account-heading">
          <div>
            <p className="eyebrow">Conta</p>
            <h1>Minha conta</h1>
            <p className="page-subtitle">Dados do usuário e preferências básicas do painel.</p>
          </div>
          <img className="account-avatar" src={profile.profileImagePath || "/assets/user-icon.png"} alt="Foto da conta" />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Informações pessoais</h2>
              <p>Atualize os dados usados no perfil da plataforma.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleProfileSubmit}>
            <label>
              <span>Nome</span>
              <input value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} />
            </label>
            <label>
              <span>E-mail</span>
              <input type="email" value={profile.email} disabled={user?.role === "CLINIC"} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
            </label>
            {profileError && <p className="form-error full-width">{profileError}</p>}
            {profileMessage && <p className="form-success full-width">{profileMessage}</p>}
            <button className="primary-button fit-button" type="submit">Salvar informações</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Senha</h2>
              <p>Use pelo menos 8 caracteres para a nova senha.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handlePasswordSubmit}>
            <label>
              <span>Senha atual</span>
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Nova senha</span>
              <input
                type="password"
                value={passwords.newPassword}
                onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                required
              />
            </label>
            {passwordError && <p className="form-error full-width">{passwordError}</p>}
            {passwordMessage && <p className="form-success full-width">{passwordMessage}</p>}
            <button className="primary-button fit-button" type="submit">Atualizar senha</button>
          </form>
        </section>
      </main>
    </div>
  );
}
