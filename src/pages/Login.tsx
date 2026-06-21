import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, loginAsGuest } from "../services/authService";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    const result = login(email, password);
    if (!result.success) return setError(result.message);
    navigate(result.role === "admin" ? "/admin" : "/chat");
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    setError("");
    navigate("/chat");
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Icon */}
        <div style={styles.iconWrapper}>
          <img src="/logossc.png" alt="Logo" style={styles.logo}/>
        </div>

        <h2 style={styles.title}>Login</h2>

        <p style={styles.subtitle}>Chatbot Layanan Administrasi UKM dan Ormawa</p>

        {error && (
          <div style={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="contoh@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = "#6c63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Masukkan password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = "#6c63ff")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <button
          style={styles.button}
          onClick={handleLogin}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#574fd6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#6c63ff")}
        >
          Masuk →
        </button>

        <button
          style={styles.guestButton}
          onClick={handleGuestLogin}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fff")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.88)")
          }
        >
          Masuk sebagai Guest
        </button>

        <p style={styles.footerText}>
          Belum punya akun?{" "}
          <Link to="/register" style={styles.link}>
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "1rem",
  },
  card: {
    background: "linear-gradient(135deg, #f3174e 0%, #670010 100%, #670010 100%)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "24px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.4)",
  },
  iconWrapper: {
    textAlign: "center",
  },
  logo: {
  width: "150px",
  height: "150px",
  objectFit: "contain",
  },
  title: {
    color: "#ffffff",
    fontSize: "1.8rem",
    fontWeight: 700,
    textAlign: "center",
    margin: "0 0 0.1rem 0",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    fontSize: "0.9rem",
    marginBottom: "1.8rem",
  },
  errorBox: {
    background: "#db0727 30%",
    color: "#f8f6f6",
    borderRadius: "10px",
    padding: "0.50rem 1rem",
    fontSize: "0.85rem",
    marginBottom: "0.5rem",
  },
  inputGroup: {
    marginBottom: "1.2rem",
  },
  label: {
    display: "block",
    color: "rgba(255,255,255,0.7)",
    fontSize: "0.85rem",
    marginBottom: "0.4rem",
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "0.8rem 1rem",
    borderRadius: "12px",
    border: "1px solid #0e0c0c",
    color: "#0e0c0c",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "0.9rem",
    background: "#6c63ff",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
    marginTop: "0.5rem",
    marginBottom: "1.2rem",
  },
  guestButton: {
    width: "100%",
    padding: "0.9rem",
    background: "rgba(255,255,255,0.88)",
    color: "#670010",
    border: "1px solid rgba(255,255,255,0.6)",
    borderRadius: "12px",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.2s",
    marginBottom: "1.2rem",
  },
  footerText: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.9rem",
    margin: 0,
  },
  link: {
    color: "#6c63ff",
    textDecoration: "none",
    fontWeight: 600,
  },
};

export default Login;
