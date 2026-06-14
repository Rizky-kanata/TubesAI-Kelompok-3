import { useState } from "react";
import { loginAdmin } from "../services/adminAuthService";

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToChat: () => void;
}

function AdminLogin({ onLoginSuccess, onBackToChat }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (loginAdmin(username, password)) {
      setError("");
      onLoginSuccess();
      return;
    }

    setError("Username atau password admin tidak sesuai.");
  };

  return (
    <div className="admin-page">
      <section className="admin-login-panel" aria-labelledby="admin-login-title">
        <div className="admin-login-header">
          <span className="admin-eyebrow">Admin Area</span>
          <h1 id="admin-login-title">Login Admin</h1>
          <p>Masuk untuk mengelola dokumen knowledge base chatbot.</p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoFocus
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              value={username}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error && <p className="admin-error">{error}</p>}

          <div className="admin-actions">
            <button className="admin-primary-btn" type="submit">
              Masuk
            </button>
            <button
              className="admin-secondary-btn"
              onClick={onBackToChat}
              type="button"
            >
              Chatbot
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AdminLogin;
